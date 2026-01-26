import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ProfileService } from "./profile/profile.service";
import { SupabaseService } from "./supabase/supabase.service";
import { EventsModule } from "./events/events.module";
import { PrometheusModule, RpcMetricsInterceptor } from "@app/common";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    // Prometheus Metrics Module (TCP mode - metrics served on separate port)
    PrometheusModule.forRoot({
      serviceName: process.env.OTEL_SERVICE_NAME || "auth-service",
      isHttpService: false,
      metricsPort: parseInt(process.env.METRICS_PORT || "9091", 10),
      enableDefaultMetrics: true,
    }),
    EventsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ProfileService,
    SupabaseService,
    // RPC Metrics Interceptor for TCP message patterns
    {
      provide: APP_INTERCEPTOR,
      useClass: RpcMetricsInterceptor,
    },
  ],
})
export class AuthModule {}
