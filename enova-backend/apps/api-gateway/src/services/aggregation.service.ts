import { Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { catchError, firstValueFrom, of, timeout } from "rxjs";
import { CircuitBreakerService } from "./circuit-breaker.service";

export interface DashboardData {
    profile: ProfileData | null;
    posts: PostData[];
    cached: boolean;
    errors: string[];
}

export interface ProfileData {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
}

export interface PostData {
    id: string;
    title: string;
    content: string;
    created_at: string;
    author_id: string;
}

/**
 * Servicio de Agregación de Requests
 *
 * Combina datos de múltiples microservicios en una sola respuesta,
 * manejando fallos individuales con fallbacks.
 */
@Injectable()
export class AggregationService {
    private readonly logger = new Logger(AggregationService.name);

    // Cache simple en memoria para fallback
    private readonly profileCache = new Map<
        string,
        { data: ProfileData; timestamp: number }
    >();
    private readonly postsCache = new Map<
        string,
        { data: PostData[]; timestamp: number }
    >();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    constructor(private circuitBreakerService: CircuitBreakerService) {}

    /**
     * Obtiene datos del dashboard combinando Auth Service y Community Service
     */
    async getDashboard(
        userId: string,
        authClient: ClientProxy,
        communityClient: ClientProxy,
    ): Promise<DashboardData> {
        const errors: string[] = [];
        let cached = false;

        // Obtener perfil con Circuit Breaker
        const profile = await this.circuitBreakerService.wrap<
            ProfileData | null
        >(
            "auth-service-profile",
            async () => {
                const result = await firstValueFrom(
                    authClient.send({ cmd: "get_profile" }, { userId }).pipe(
                        timeout(4000),
                    ),
                );
                // Actualizar cache
                this.profileCache.set(userId, {
                    data: result,
                    timestamp: Date.now(),
                });
                return result;
            },
            () => {
                // Fallback: intentar cache
                const cached = this.profileCache.get(userId);
                if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                    this.logger.debug("Usando perfil cacheado");
                    return cached.data;
                }
                errors.push("Profile service unavailable");
                return null;
            },
        );

        // Obtener posts con Circuit Breaker
        const posts = await this.circuitBreakerService.wrap<PostData[]>(
            "community-service-posts",
            async () => {
                const result = await firstValueFrom(
                    communityClient.send({ cmd: "get_user_posts" }, {
                        userId,
                        limit: 10,
                    }).pipe(
                        timeout(4000),
                    ),
                );
                // Actualizar cache
                this.postsCache.set(userId, {
                    data: result,
                    timestamp: Date.now(),
                });
                return result;
            },
            () => {
                // Fallback: intentar cache o array vacío
                const cachedPosts = this.postsCache.get(userId);
                if (
                    cachedPosts &&
                    Date.now() - cachedPosts.timestamp < this.CACHE_TTL
                ) {
                    this.logger.debug("Usando posts cacheados");
                    cached = true;
                    return cachedPosts.data;
                }
                errors.push("Community service unavailable");
                cached = true;
                return [];
            },
        );

        return {
            profile,
            posts,
            cached: cached || errors.length > 0,
            errors,
        };
    }

    /**
     * Obtiene estadísticas de los circuit breakers
     */
    getCircuitStats() {
        return this.circuitBreakerService.getAllStats();
    }

    /**
     * Limpia caches (útil para testing y administración)
     */
    clearCaches(): void {
        this.profileCache.clear();
        this.postsCache.clear();
        this.logger.log("Caches de agregación limpiados");
    }
}
