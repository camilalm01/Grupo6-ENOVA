import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { SupabaseAuthGuard } from "./guards/supabase-auth.guard";
import { ProxyModule } from "./proxy/proxy.module";
import { CircuitBreakerService } from "./services/circuit-breaker.service";
import { AggregationService } from "./services/aggregation.service";
import { CircuitBreakerInterceptor } from "./interceptors/circuit-breaker.interceptor";
import { HealthController } from "./health/health.controller";

@Module({
    imports: [
        // Configuración centralizada
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
        }),

        // Rate Limiting global
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => [{
                ttl: configService.get<number>("RATE_LIMIT_TTL") || 60000,
                limit: configService.get<number>("RATE_LIMIT_MAX") || 100,
            }],
        }),

        // Cliente para Auth Service (TCP)
        ClientsModule.registerAsync([
            {
                name: "AUTH_SERVICE",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.TCP,
                    options: {
                        host: configService.get<string>("AUTH_SERVICE_HOST") ||
                            "localhost",
                        port: configService.get<number>("AUTH_SERVICE_PORT") ||
                            3001,
                    },
                }),
            },
            {
                name: "COMMUNITY_SERVICE",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.TCP,
                    options: {
                        host: configService.get<string>(
                            "COMMUNITY_SERVICE_HOST",
                        ) || "localhost",
                        port: configService.get<number>(
                            "COMMUNITY_SERVICE_PORT",
                        ) || 3003,
                    },
                }),
            },
        ]),

        ProxyModule,
    ],
    controllers: [HealthController],
    providers: [
        // Circuit Breaker Service
        CircuitBreakerService,
        AggregationService,

        // Guard global para autenticación
        {
            provide: APP_GUARD,
            useClass: SupabaseAuthGuard,
        },

        // Rate Limiting Guard
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },

        // Circuit Breaker Interceptor (opcional, para usar con decorador)
        {
            provide: APP_INTERCEPTOR,
            useClass: CircuitBreakerInterceptor,
        },
    ],
    exports: [CircuitBreakerService, AggregationService],
})
export class AppModule {}
