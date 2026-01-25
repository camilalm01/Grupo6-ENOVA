import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { AuthenticatedUser } from "../auth/jwt-validation.service";
import { encodeUserPayload, INTERNAL_HEADERS, IUserPayload } from "@app/common";

/**
 * Request con usuario autenticado
 */
interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

/**
 * User Payload Middleware
 *
 * Inyecta el payload del usuario en los headers para propagación
 * a los microservicios internos.
 *
 * Headers inyectados:
 * - X-User-Payload: Base64 encoded JSON del usuario
 * - X-Internal-Key: Clave secreta para autenticación de servicio
 * - X-Request-Id: ID único para tracing
 * - X-Original-IP: IP original del cliente
 */
@Injectable()
export class UserPayloadMiddleware implements NestMiddleware {
    private readonly logger = new Logger(UserPayloadMiddleware.name);
    private readonly internalKey: string;

    constructor(private readonly configService: ConfigService) {
        this.internalKey =
            this.configService.get<string>("INTERNAL_SERVICE_KEY") ||
            "default-internal-key-change-in-production";
    }

    use(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
        // Generar Request ID si no existe
        const requestId = req.headers["x-request-id"] as string ||
            this.generateRequestId();

        // Obtener IP original
        const originalIp = this.getClientIp(req);

        // Si hay usuario autenticado, codificar payload
        if (req.user) {
            // Adaptar AuthenticatedUser a IUserPayload si es necesario
            // Asumimos que son compatibles por ahora
            const userPayload = encodeUserPayload(
                req.user as unknown as IUserPayload,
            );
            req.headers[INTERNAL_HEADERS.USER_PAYLOAD] = userPayload;
        }

        // Inyectar headers internos
        req.headers[INTERNAL_HEADERS.INTERNAL_KEY] = this.internalKey;
        req.headers[INTERNAL_HEADERS.REQUEST_ID] = requestId;
        req.headers[INTERNAL_HEADERS.ORIGINAL_IP] = originalIp;

        // También en response para debugging
        res.setHeader("X-Request-Id", requestId);

        next();
    }

    /**
     * Genera un ID único para el request
     */
    private generateRequestId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 9);
        return `${timestamp}-${random}`;
    }

    /**
     * Extrae la IP real del cliente
     */
    private getClientIp(req: Request): string {
        const forwarded = req.headers["x-forwarded-for"];

        if (typeof forwarded === "string") {
            return forwarded.split(",")[0].trim();
        }

        if (Array.isArray(forwarded)) {
            return forwarded[0];
        }

        return req.ip || req.socket.remoteAddress || "unknown";
    }
}
