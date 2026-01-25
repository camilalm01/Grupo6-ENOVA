import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jose from "jose";

/**
 * Usuario autenticado en WebSocket
 */
export interface WsAuthUser {
    id: string;
    email: string | null;
    role: string;
    displayName: string | null;
    avatarUrl: string | null;
}

/**
 * Resultado de validación de WebSocket
 */
export interface WsAuthResult {
    valid: boolean;
    user?: WsAuthUser;
    error?: string;
}

/**
 * WebSocket Auth Service
 *
 * Valida tokens JWT durante el handshake de WebSocket.
 * Usa el JWT secret directamente ya que no podemos hacer async en handleConnection fácilmente.
 */
@Injectable()
export class WsAuthService {
    private readonly logger = new Logger(WsAuthService.name);
    private readonly jwtSecret: Uint8Array;
    private readonly enabled: boolean;

    constructor(private readonly configService: ConfigService) {
        const secret = this.configService.get<string>("SUPABASE_JWT_SECRET");
        this.jwtSecret = new TextEncoder().encode(secret || "fallback-secret");
        this.enabled =
            this.configService.get<boolean>("WS_AUTH_ENABLED") !== false;
    }

    /**
     * Valida un token JWT para WebSocket
     */
    async validateToken(token: string): Promise<WsAuthResult> {
        if (!this.enabled) {
            this.logger.debug("WS Auth deshabilitado");
            return {
                valid: true,
                user: {
                    id: "anonymous",
                    email: null,
                    role: "user",
                    displayName: "Anonymous",
                    avatarUrl: null,
                },
            };
        }

        if (!token) {
            return { valid: false, error: "Token no proporcionado" };
        }

        try {
            const { payload } = await jose.jwtVerify(token, this.jwtSecret);

            // Verificar expiración
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) {
                return { valid: false, error: "Token expirado" };
            }

            // Extraer usuario
            const user: WsAuthUser = {
                id: payload.sub as string,
                email: (payload.email as string) || null,
                role:
                    (payload as { app_metadata?: { role?: string } })
                        .app_metadata?.role ||
                    (payload.role as string) || "user",
                displayName:
                    (payload as { user_metadata?: { display_name?: string } })
                        .user_metadata?.display_name || null,
                avatarUrl:
                    (payload as { user_metadata?: { avatar_url?: string } })
                        .user_metadata?.avatar_url || null,
            };

            return { valid: true, user };
        } catch (error) {
            this.logger.error(
                `Error validando token WS: ${(error as Error).message}`,
            );
            return { valid: false, error: "Token inválido" };
        }
    }

    /**
     * Extrae el token de diferentes fuentes del handshake
     */
    extractToken(
        client: {
            handshake: {
                query: Record<string, unknown>;
                auth: Record<string, unknown>;
                headers: Record<string, unknown>;
            };
        },
    ): string | null {
        // 1. Query parameter: ?token=xxx
        const queryToken = client.handshake.query?.token as string;
        if (queryToken) return queryToken;

        // 2. Auth object: { token: 'xxx' }
        const authToken = client.handshake.auth?.token as string;
        if (authToken) return authToken;

        // 3. Authorization header
        const authHeader = client.handshake.headers?.authorization as string;
        if (authHeader?.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        return null;
    }

    /**
     * Verifica si un usuario puede acceder a una sala específica
     */
    async canAccessRoom(userId: string, roomId: string): Promise<boolean> {
        // Por defecto, salas públicas son accesibles
        // En producción, verificar en la base de datos

        // TODO: Implementar verificación real con base de datos
        // const roomMember = await this.roomMembersRepository.findOne({
        //   where: { roomId, userId },
        // });
        // return !!roomMember;

        this.logger.debug(
            `Verificando acceso a room ${roomId} para usuario ${userId}`,
        );
        return true; // Placeholder - implementar lógica real
    }
}
