import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
    Permission,
    PERMISSIONS_KEY,
    roleHasPermission,
} from "../decorators/permissions.decorator";

/**
 * Usuario con permisos en el request
 */
interface RequestUser {
    id: string;
    role: string;
    permissions?: Permission[];
}

/**
 * Permissions Guard
 *
 * Guard que verifica permisos granulares basados en la matriz ROLE_PERMISSIONS.
 * Soporta permisos con scope (own, any) para validación de ownership.
 *
 * @example
 * ```typescript
 * @UseGuards(PermissionsGuard)
 * @Permissions('posts:delete:any')
 * @Delete('posts/:id')
 * async deleteAnyPost() { ... }
 * ```
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
    private readonly logger = new Logger(PermissionsGuard.name);

    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        // Obtener permisos requeridos del decorador
        const requiredPermissions = this.reflector.getAllAndOverride<
            Permission[]
        >(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );

        // Si no hay permisos requeridos, permitir acceso
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        // Obtener usuario del request
        const request = context.switchToHttp().getRequest();
        const user = request.user as RequestUser;

        if (!user) {
            throw new ForbiddenException("Usuario no autenticado");
        }

        // Verificar que el usuario tenga TODOS los permisos requeridos
        const hasAllPermissions = requiredPermissions.every((permission) =>
            this.userHasPermission(user, permission)
        );

        if (!hasAllPermissions) {
            const missing = requiredPermissions.filter(
                (p) => !this.userHasPermission(user, p),
            );

            this.logger.warn(
                `Usuario ${user.id} sin permisos: ${missing.join(", ")}`,
            );

            throw new ForbiddenException(
                `Permisos insuficientes. Requeridos: ${
                    requiredPermissions.join(", ")
                }`,
            );
        }

        return true;
    }

    /**
     * Verifica si el usuario tiene un permiso específico
     */
    private userHasPermission(
        user: RequestUser,
        permission: Permission,
    ): boolean {
        // Primero verificar permisos personalizados del usuario
        if (user.permissions?.includes(permission)) {
            return true;
        }

        // Luego verificar por rol
        return roleHasPermission(user.role, permission);
    }
}

/**
 * Decorador combinado para rutas que requieren roles Y permisos
 */
export function RequireAuth(roles?: string[], permissions?: Permission[]) {
    return function (
        target: object,
        key?: string | symbol,
        descriptor?: PropertyDescriptor,
    ) {
        if (roles && roles.length > 0) {
            Reflect.defineMetadata("roles", roles, descriptor?.value || target);
        }
        if (permissions && permissions.length > 0) {
            Reflect.defineMetadata(
                PERMISSIONS_KEY,
                permissions,
                descriptor?.value || target,
            );
        }
    };
}
