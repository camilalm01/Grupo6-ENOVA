import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

/**
 * Roles disponibles en el sistema
 */
export type UserRole = "user" | "admin" | "moderator";

/**
 * Metadata key para el decorador @Roles
 */
export const ROLES_KEY = "roles";

/**
 * Decorador para especificar roles requeridos
 *
 * @example
 * ```typescript
 * @Roles('admin', 'moderator')
 * @Delete('posts/:id')
 * async deleteAnyPost() { ... }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Guard basado en roles
 *
 * Reemplaza políticas RLS basadas en roles:
 * ```sql
 * CREATE POLICY "Admins can delete any post"
 * ON posts FOR DELETE
 * USING (
 *   EXISTS (
 *     SELECT 1 FROM profiles
 *     WHERE id = auth.uid() AND role = 'admin'
 *   )
 * );
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // Si no hay roles requeridos, permitir acceso
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException("Usuario no autenticado");
        }

        const hasRole = requiredRoles.includes(user.role as UserRole);

        if (!hasRole) {
            throw new ForbiddenException(
                `Rol requerido: ${
                    requiredRoles.join(" o ")
                }. Tu rol: ${user.role}`,
            );
        }

        return true;
    }
}

/**
 * Matriz de permisos por recurso y acción
 *
 * Centraliza la lógica de autorización que antes estaba en RLS
 */
export const PERMISSIONS_MATRIX: Record<string, Record<string, UserRole[]>> = {
    posts: {
        "read:any": ["user", "admin", "moderator"],
        "create": ["user", "admin"],
        "update:own": ["user", "admin"],
        "update:any": ["admin", "moderator"],
        "delete:own": ["user", "admin"],
        "delete:any": ["admin"],
        "pin": ["admin", "moderator"],
        "flag": ["admin", "moderator"],
    },
    profiles: {
        "read:own": ["user", "admin", "moderator"],
        "read:any": ["admin", "moderator"],
        "update:own": ["user", "admin"],
        "update:any": ["admin"],
        "delete:own": ["user", "admin"],
        "delete:any": ["admin"],
    },
    messages: {
        "read:room": ["user", "admin", "moderator"],
        "create": ["user", "admin", "moderator"],
        "update:own": ["user", "admin"],
        "delete:own": ["user", "admin", "moderator"],
        "delete:any": ["admin", "moderator"],
    },
    rooms: {
        "create:public": ["admin", "moderator"],
        "create:private": ["user", "admin", "moderator"],
        "join:public": ["user", "admin", "moderator"],
        "join:private": [], // Requiere invitación
        "manage": ["admin"],
    },
};

/**
 * Helper para verificar permisos
 */
export function hasPermission(
    role: UserRole,
    resource: string,
    action: string,
): boolean {
    const resourcePerms = PERMISSIONS_MATRIX[resource];
    if (!resourcePerms) return false;

    const allowedRoles = resourcePerms[action];
    if (!allowedRoles) return false;

    return allowedRoles.includes(role);
}
