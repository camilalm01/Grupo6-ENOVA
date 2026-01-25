import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Logger,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import {
    decodeUserPayload,
    INTERNAL_HEADERS,
    IUserPayload,
} from "../utils/user-payload.util";

/**
 * Request con usuario interno
 */
export interface InternalRequest extends Request {
    user: IUserPayload;
}

/**
 * Internal Service Guard
 *
 * Guard para microservicios que valida:
 * 1. El header X-Internal-Key coincide con el secret configurado
 * 2. Extrae el usuario desde X-User-Payload
 *
 * Este guard asegura que solo el Gateway puede comunicarse con los microservicios.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
    private readonly logger = new Logger(InternalServiceGuard.name);
    private readonly internalKey: string;
    private readonly enabled: boolean;

    constructor(private readonly configService: ConfigService) {
        this.internalKey =
            this.configService.get<string>("INTERNAL_SERVICE_KEY") ||
            "default-internal-key-change-in-production";
        this.enabled =
            this.configService.get<boolean>("ENABLE_INTERNAL_AUTH") !== false;
    }

    canActivate(context: ExecutionContext): boolean {
        // Si está deshabilitado (desarrollo), permitir todo
        if (!this.enabled) {
            this.logger.debug(
                "Internal auth deshabilitado, permitiendo request",
            );
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();

        // Validar Internal Key
        const providedKey = request
            .headers[INTERNAL_HEADERS.INTERNAL_KEY] as string;

        if (!providedKey) {
            this.logger.warn("Request sin X-Internal-Key");
            throw new UnauthorizedException("Missing internal authentication");
        }

        if (providedKey !== this.internalKey) {
            this.logger.warn("X-Internal-Key inválido");
            throw new UnauthorizedException("Invalid internal authentication");
        }

        // Extraer usuario del payload
        const userPayload = request
            .headers[INTERNAL_HEADERS.USER_PAYLOAD] as string;

        if (userPayload) {
            const user = decodeUserPayload(userPayload);
            if (user) {
                (request as InternalRequest).user = user;
            }
        }

        return true;
    }
}

/**
 * Decorador para marcar que un controller requiere autenticación interna
 */
export function InternalOnly(): ClassDecorator & MethodDecorator {
    return (target: object, propertyKey?: string | symbol) => {
        if (propertyKey) {
            Reflect.defineMetadata("internal_only", true, target, propertyKey);
        } else {
            Reflect.defineMetadata("internal_only", true, target);
        }
    };
}
