import {
    Body,
    Controller,
    Delete,
    Get,
    Inject,
    Param,
    Post,
    Request,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { catchError, firstValueFrom, of, timeout } from "rxjs";
import { Public } from "../guards/supabase-auth.guard";
import { CircuitBreakerService } from "../services/circuit-breaker.service";
import {
    AggregationService,
    DashboardData,
} from "../services/aggregation.service";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        email: string;
        role: string;
    };
}

@Controller()
export class ProxyController {
    constructor(
        @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
        @Inject("COMMUNITY_SERVICE") private readonly communityClient:
            ClientProxy,
        private readonly circuitBreakerService: CircuitBreakerService,
        private readonly aggregationService: AggregationService,
    ) {}

    // ═══════════════════════════════════════════════════════════
    // RUTAS PÚBLICAS (Sin autenticación, con Rate Limiting)
    // ═══════════════════════════════════════════════════════════

    @Public()
    @Get("health")
    getHealth() {
        return {
            status: "ok",
            service: "api-gateway",
            timestamp: new Date().toISOString(),
            circuits: this.circuitBreakerService.getAllStats(),
        };
    }

    // ═══════════════════════════════════════════════════════════
    // REQUEST AGGREGATION - Dashboard
    // ═══════════════════════════════════════════════════════════

    /**
     * Endpoint agregado: combina perfil + posts del usuario
     * Con Circuit Breaker y fallback para cada servicio
     */
    @Get("dashboard")
    async getDashboard(
        @Request() req: AuthenticatedRequest,
    ): Promise<DashboardData> {
        return this.aggregationService.getDashboard(
            req.user.id,
            this.authClient,
            this.communityClient,
        );
    }

    // ═══════════════════════════════════════════════════════════
    // PROXY A AUTH SERVICE - PERFILES
    // ═══════════════════════════════════════════════════════════

    @Get("profile/me")
    async getMyProfile(@Request() req: AuthenticatedRequest) {
        return this.circuitBreakerService.wrap(
            "auth-service",
            () =>
                firstValueFrom(
                    this.authClient.send({ cmd: "get_profile" }, {
                        userId: req.user.id,
                    }).pipe(
                        timeout(5000),
                    ),
                ),
            () => ({
                error: "Auth service temporarily unavailable",
                cached: true,
            }),
        );
    }

    @Get("profile/:userId")
    async getProfile(@Param("userId") userId: string) {
        return this.circuitBreakerService.wrap(
            "auth-service",
            () =>
                firstValueFrom(
                    this.authClient.send({ cmd: "get_profile" }, { userId })
                        .pipe(
                            timeout(5000),
                        ),
                ),
            () => ({
                error: "Auth service temporarily unavailable",
                cached: true,
            }),
        );
    }

    @Post("profile/me")
    async updateMyProfile(
        @Request() req: AuthenticatedRequest,
        @Body() updateData: Record<string, unknown>,
    ) {
        return firstValueFrom(
            this.authClient.send(
                { cmd: "update_profile" },
                { userId: req.user.id, ...updateData },
            ),
        );
    }

    @Post("profile/:userId")
    async updateProfile(
        @Param("userId") userId: string,
        @Body() updateData: Record<string, unknown>,
    ) {
        return firstValueFrom(
            this.authClient.send({ cmd: "update_profile" }, {
                userId,
                ...updateData,
            }),
        );
    }

    // ═══════════════════════════════════════════════════════════
    // ELIMINACIÓN DE CUENTA (Inicia Saga)
    // ═══════════════════════════════════════════════════════════

    /**
     * Elimina la cuenta del usuario - Inicia el flujo Saga
     * 1. Auth Service marca perfil como eliminado
     * 2. Auth Service publica evento user.deleted
     * 3. Community y Chat Services reaccionan al evento
     */
    @Delete("account")
    async deleteAccount(@Request() req: AuthenticatedRequest) {
        return firstValueFrom(
            this.authClient.send(
                { cmd: "delete_account" },
                { userId: req.user.id, email: req.user.email },
            ),
        );
    }

    // ═══════════════════════════════════════════════════════════
    // PROXY A COMMUNITY SERVICE - POSTS (Con Circuit Breaker)
    // ═══════════════════════════════════════════════════════════

    @Get("posts")
    async getPosts(@Request() req: AuthenticatedRequest) {
        return this.circuitBreakerService.wrap(
            "community-service",
            () =>
                firstValueFrom(
                    this.communityClient.send(
                        { cmd: "get_posts" },
                        { userId: req.user.id, limit: 20 },
                    ).pipe(timeout(5000)),
                ),
            () => ({
                posts: [],
                message:
                    "Community service temporarily unavailable. Please try again later.",
                cached: true,
            }),
        );
    }

    @Get("posts/:postId")
    async getPost(@Param("postId") postId: string) {
        return this.circuitBreakerService.wrap(
            "community-service",
            () =>
                firstValueFrom(
                    this.communityClient.send({ cmd: "get_post" }, { postId })
                        .pipe(
                            timeout(5000),
                        ),
                ),
            () => ({
                error: "Post not available",
                cached: true,
            }),
        );
    }

    @Post("posts")
    async createPost(
        @Request() req: AuthenticatedRequest,
        @Body() postData: Record<string, unknown>,
    ) {
        return firstValueFrom(
            this.communityClient.send(
                { cmd: "create_post" },
                { authorId: req.user.id, ...postData },
            ),
        );
    }

    // ═══════════════════════════════════════════════════════════
    // VALIDACIÓN DE USUARIOS (USO INTERNO)
    // ═══════════════════════════════════════════════════════════

    @SkipThrottle()
    @Get("validate/:userId")
    async validateUser(@Param("userId") userId: string) {
        return firstValueFrom(
            this.authClient.send({ cmd: "validate_user" }, { userId }),
        );
    }

    // ═══════════════════════════════════════════════════════════
    // CIRCUIT BREAKER STATUS (Para monitoreo)
    // ═══════════════════════════════════════════════════════════

    @Public()
    @Get("circuits/status")
    getCircuitStatus() {
        return {
            circuits: this.circuitBreakerService.getAllStats(),
            timestamp: new Date().toISOString(),
        };
    }
}
