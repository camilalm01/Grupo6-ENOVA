import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ChatGateway } from "./gateways/chat.gateway";
import { ChatService } from "./services/chat.service";
import { SupabaseService } from "./services/supabase.service";
import { WsAuthService } from "./auth/ws-auth.service";
import { EventsModule } from "./events/events.module";
import {
  IdempotencyService,
  PrometheusModule,
  WsMetricsInterceptor,
} from "@app/common";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // Prometheus Metrics Module (HTTP mode - serves /metrics on main port)
    PrometheusModule.forRoot({
      serviceName: process.env.OTEL_SERVICE_NAME || "chat-service",
      isHttpService: true,
      metricsPath: "/metrics",
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
            queue: "chat_events",
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),

    EventsModule,
  ],
  providers: [
    ChatGateway,
    ChatService,
    SupabaseService,
    WsAuthService,
    IdempotencyService,
    // WebSocket Metrics Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: WsMetricsInterceptor,
    },
  ],
})
export class ChatModule {}
