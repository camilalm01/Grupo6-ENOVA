import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Logger,
    UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import {
    AuthenticatedUser,
    JwtValidationService,
} from "../auth/jwt-validation.service";

/**
 * Metadata key para marcar rutas como públicas
 */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * Decorador para marcar rutas públicas (sin autenticación)
 */
export const Public = () => Reflect.metadata(IS_PUBLIC_KEY, true);

/**
 * Extiende Request con el usuario autenticado
 */
export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}

/**
 * Global Auth Guard
 *
 * Guard centralizado que valida todos los JWT entrantes usando JWKS.
 * Actúa como el "Policía de Frontera" del Gateway.
 */
@Injectable()
export class GlobalAuthGuard implements CanActivate {
    private readonly logger = new Logger(GlobalAuthGuard.name);

    constructor(
        private readonly jwtValidationService: JwtValidationService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Verificar si la ruta es pública
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [
                context.getHandler(),
                context.getClass(),
            ],
        );

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException("Token no proporcionado");
        }

        try {
            // Validar token y obtener usuario
            const user = await this.jwtValidationService.validateToken(token);

            // Adjuntar usuario al request
            (request as AuthenticatedRequest).user = user;

            // Log para auditoría (nivel debug)
            this.logger.debug(
                `Usuario autenticado: ${user.id} (${user.email})`,
            );

            return true;
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }

            this.logger.error(
                `Error de autenticación: ${(error as Error).message}`,
            );
            throw new UnauthorizedException("Token inválido");
        }
    }

    /**
     * Extrae el token del header Authorization
     */
    private extractTokenFromHeader(request: Request): string | null {
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            return null;
        }

        const [type, token] = authHeader.split(" ");

        if (type !== "Bearer" || !token) {
            return null;
        }

        return token;
    }
}
