import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jose from "jose";

/**
 * Interfaz para una clave JWKS
 */
export interface JwkKey {
    kty: string;
    kid: string;
    n?: string;
    e?: string;
    alg?: string;
    use?: string;
}

/**
 * JWKS Service
 *
 * Fetcha y cachea las claves públicas de Supabase para validación de JWT.
 * Implementa cache con TTL para evitar requests excesivos al IdP.
 */
@Injectable()
export class JwksService implements OnModuleInit {
    private readonly logger = new Logger(JwksService.name);
    private jwksCache: Map<string, jose.KeyLike> = new Map();
    private lastFetchTime = 0;
    private readonly cacheTTL: number;
    private readonly jwksUrl: string;
    private jwks: jose.JSONWebKeySet | null = null;

    constructor(private readonly configService: ConfigService) {
        const supabaseUrl = this.configService.get<string>("SUPABASE_URL");
        this.jwksUrl = this.configService.get<string>("SUPABASE_JWKS_URL") ||
            `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
        this.cacheTTL = this.configService.get<number>("JWKS_CACHE_TTL") ||
            3600000; // 1 hora
    }

    async onModuleInit() {
        // Pre-cargar JWKS al iniciar
        try {
            await this.refreshKeys();
            this.logger.log("JWKS cargadas exitosamente");
        } catch (error) {
            this.logger.warn(
                `No se pudieron cargar JWKS al inicio: ${
                    (error as Error).message
                }`,
            );
        }
    }

    /**
     * Obtiene la clave pública para un kid específico
     */
    async getPublicKey(kid: string): Promise<jose.KeyLike> {
        // Verificar si necesitamos refrescar el cache
        if (this.shouldRefreshCache()) {
            await this.refreshKeys();
        }

        // Buscar en cache
        const cachedKey = this.jwksCache.get(kid);
        if (cachedKey) {
            return cachedKey;
        }

        // Si no está en cache, refrescar y buscar de nuevo
        await this.refreshKeys();
        const key = this.jwksCache.get(kid);

        if (!key) {
            throw new Error(`No se encontró clave pública para kid: ${kid}`);
        }

        return key;
    }

    /**
     * Refresca las claves desde el endpoint JWKS
     */
    async refreshKeys(): Promise<void> {
        try {
            this.logger.debug(`Fetching JWKS from: ${this.jwksUrl}`);

            const response = await fetch(this.jwksUrl);

            if (!response.ok) {
                throw new Error(`JWKS fetch failed: ${response.status}`);
            }

            const jwks = await response.json() as jose.JSONWebKeySet;
            this.jwks = jwks;

            // Convertir cada JWK a KeyLike y cachear
            this.jwksCache.clear();

            for (const key of jwks.keys) {
                if (key.kid) {
                    const publicKey = await jose.importJWK(
                        key,
                        key.alg || "RS256",
                    );
                    this.jwksCache.set(key.kid, publicKey as jose.KeyLike);
                }
            }

            this.lastFetchTime = Date.now();
            this.logger.log(
                `JWKS actualizadas: ${this.jwksCache.size} claves cacheadas`,
            );
        } catch (error) {
            this.logger.error(
                `Error fetching JWKS: ${(error as Error).message}`,
            );
            throw error;
        }
    }

    /**
     * Determina si el cache necesita ser refrescado
     */
    private shouldRefreshCache(): boolean {
        // Si no hay claves cacheadas, refrescar
        if (this.jwksCache.size === 0) {
            return true;
        }

        // Si pasó el TTL, refrescar
        return Date.now() - this.lastFetchTime > this.cacheTTL;
    }

    /**
     * Obtiene todas las claves cacheadas (para debugging)
     */
    getCachedKeyIds(): string[] {
        return Array.from(this.jwksCache.keys());
    }

    /**
     * Obtiene el tiempo hasta la próxima expiración del cache
     */
    getCacheTimeRemaining(): number {
        const elapsed = Date.now() - this.lastFetchTime;
        return Math.max(0, this.cacheTTL - elapsed);
    }
}
