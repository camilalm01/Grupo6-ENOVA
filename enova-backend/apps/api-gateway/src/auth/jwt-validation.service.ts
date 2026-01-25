import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jose from "jose";
import { JwksService } from "./jwks.service";

/**
 * Payload decodificado del JWT de Supabase
 */
export interface SupabaseJwtPayload {
    sub: string; // User ID
    email?: string;
    phone?: string;
    role?: string; // Supabase role (authenticated, anon)
    app_metadata?: {
        provider?: string;
        role?: string; // Custom app role
    };
    user_metadata?: {
        display_name?: string;
        avatar_url?: string;
    };
    aud: string;
    iat: number;
    exp: number;
    iss: string;
}

/**
 * Usuario normalizado para uso interno
 */
export interface AuthenticatedUser {
    id: string;
    email: string | null;
    role: string;
    displayName: string | null;
    avatarUrl: string | null;
    iat: number;
    exp: number;
}

/**
 * JWT Validation Service
 *
 * Valida tokens JWT usando JWKS de Supabase.
 * Soporta fallback a JWT_SECRET para desarrollo.
 */
@Injectable()
export class JwtValidationService {
    private readonly logger = new Logger(JwtValidationService.name);
    private readonly jwtSecret: string | undefined;
    private readonly issuer: string;
    private readonly audience: string;

    constructor(
        private readonly jwksService: JwksService,
        private readonly configService: ConfigService,
    ) {
        this.jwtSecret = this.configService.get<string>("SUPABASE_JWT_SECRET");
        const supabaseUrl = this.configService.get<string>("SUPABASE_URL") ||
            "";
        this.issuer = `${supabaseUrl}/auth/v1`;
        this.audience = "authenticated";
    }

    /**
     * Valida un token JWT y retorna el payload
     */
    async validateToken(token: string): Promise<AuthenticatedUser> {
        try {
            // Decodificar header para obtener kid
            const protectedHeader = jose.decodeProtectedHeader(token);
            const kid = protectedHeader.kid;
            const alg = protectedHeader.alg || "HS256";

            let payload: SupabaseJwtPayload;

            if (kid) {
                // Validación con JWKS (producción)
                payload = await this.validateWithJwks(token, kid, alg);
            } else if (this.jwtSecret) {
                // Fallback a secret (desarrollo)
                payload = await this.validateWithSecret(token, alg);
            } else {
                throw new UnauthorizedException(
                    "No se puede validar el token: falta kid o JWT_SECRET",
                );
            }

            // Validar claims adicionales
            this.validateClaims(payload);

            // Normalizar usuario
            return this.normalizeUser(payload);
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }

            this.logger.error(
                `Error validando token: ${(error as Error).message}`,
            );
            throw new UnauthorizedException("Token inválido");
        }
    }

    /**
     * Valida token usando JWKS
     */
    private async validateWithJwks(
        token: string,
        kid: string,
        alg: string,
    ): Promise<SupabaseJwtPayload> {
        const publicKey = await this.jwksService.getPublicKey(kid);

        const { payload } = await jose.jwtVerify(token, publicKey, {
            algorithms: [alg],
            issuer: this.issuer,
            audience: this.audience,
        });

        return payload as unknown as SupabaseJwtPayload;
    }

    /**
     * Valida token usando secret (fallback para desarrollo)
     */
    private async validateWithSecret(
        token: string,
        alg: string,
    ): Promise<SupabaseJwtPayload> {
        if (!this.jwtSecret) {
            throw new Error("JWT_SECRET no configurado");
        }

        const secret = new TextEncoder().encode(this.jwtSecret);

        const { payload } = await jose.jwtVerify(token, secret, {
            algorithms: [alg],
        });

        return payload as unknown as SupabaseJwtPayload;
    }

    /**
     * Valida claims adicionales del token
     */
    private validateClaims(payload: SupabaseJwtPayload): void {
        const now = Math.floor(Date.now() / 1000);

        // Verificar expiración
        if (payload.exp && payload.exp < now) {
            throw new UnauthorizedException("Token expirado");
        }

        // Verificar que no sea un token futuro
        if (payload.iat && payload.iat > now + 60) {
            throw new UnauthorizedException("Token iat en el futuro");
        }

        // Verificar que tenga sub (user id)
        if (!payload.sub) {
            throw new UnauthorizedException("Token sin subject");
        }
    }

    /**
     * Normaliza el payload de Supabase a usuario interno
     */
    private normalizeUser(payload: SupabaseJwtPayload): AuthenticatedUser {
        return {
            id: payload.sub,
            email: payload.email || null,
            role: payload.app_metadata?.role || payload.role || "user",
            displayName: payload.user_metadata?.display_name || null,
            avatarUrl: payload.user_metadata?.avatar_url || null,
            iat: payload.iat,
            exp: payload.exp,
        };
    }

    /**
     * Decodifica un token sin validar (solo para debugging)
     */
    decodeWithoutValidation(token: string): SupabaseJwtPayload | null {
        try {
            const payload = jose.decodeJwt(token);
            return payload as unknown as SupabaseJwtPayload;
        } catch {
            return null;
        }
    }

    /**
     * Verifica si un token está próximo a expirar
     */
    isTokenExpiringSoon(token: string, thresholdSeconds = 300): boolean {
        const payload = this.decodeWithoutValidation(token);
        if (!payload?.exp) return true;

        const now = Math.floor(Date.now() / 1000);
        return payload.exp - now < thresholdSeconds;
    }
}
