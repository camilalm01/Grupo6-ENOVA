import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppRole, ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Usuario en el request
 */
interface RequestUser {
    id: string;
    role: string;
}

/**
 * Roles Guard
 *
 * Guard que verifica si el usuario tiene alguno de los roles requeridos.
 * Debe usarse junto con InternalServiceGuard o después de la autenticación.
 *
 * @example
 * ```typescript
 * @UseGuards(RolesGuard)
 * @Roles('admin', 'moderator')
 * @Get('admin/stats')
 * async getStats() { ... }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        // Obtener roles requeridos del decorador
        const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
            ROLES_KEY,
            [
                context.getHandler(),
                context.getClass(),
            ],
        );

        // Si no hay roles requeridos, permitir acceso
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        // Obtener usuario del request
        const request = context.switchToHttp().getRequest();
        const user = request.user as RequestUser;

        if (!user) {
            throw new ForbiddenException("Usuario no autenticado");
        }

        // Verificar si el rol del usuario está en los roles permitidos
        const hasRole = this.matchRoles(requiredRoles, user.role);

        if (!hasRole) {
            throw new ForbiddenException(
                `Acceso denegado. Rol requerido: ${requiredRoles.join(" o ")}`,
            );
        }

        return true;
    }

    /**
     * Verifica si el rol del usuario coincide con alguno de los requeridos
     */
    private matchRoles(requiredRoles: AppRole[], userRole: string): boolean {
        // Admin siempre tiene acceso
        if (userRole === "admin") {
            return true;
        }

        return requiredRoles.includes(userRole as AppRole);
    }
}
