import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { CommunityController } from "./community.controller";
import { PostsService } from "./posts/posts.service";
import { SupabaseService } from "./supabase/supabase.service";
import { UserEventsSubscriber } from "./events/subscribers/user-events.subscriber";
import { CompensationService } from "./saga/compensation.service";
import {
  IdempotencyService,
  PrometheusModule,
  RpcMetricsInterceptor,
} from "@app/common";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // Prometheus Metrics Module (TCP mode - metrics served on separate port)
    PrometheusModule.forRoot({
      serviceName: process.env.OTEL_SERVICE_NAME || "community-service",
      isHttpService: false,
      metricsPort: parseInt(process.env.METRICS_PORT || "9091", 10),
      enableDefaultMetrics: true,
    }),

    // Cliente RabbitMQ para publicar eventos
    ClientsModule.registerAsync([
      {
        name: "RABBITMQ_SERVICE",
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>("RABBITMQ_URL") ||
                "amqp://localhost:5672",
            ],
            queue: "community_events",
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [CommunityController],
  providers: [
    PostsService,
    SupabaseService,
    UserEventsSubscriber,
    CompensationService,
    IdempotencyService,
    // RPC Metrics Interceptor for TCP/RMQ message patterns
    {
      provide: APP_INTERCEPTOR,
      useClass: RpcMetricsInterceptor,
    },
  ],
})
export class CommunityModule {}
