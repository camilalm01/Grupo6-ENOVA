import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AuthModule } from "./auth.module";
import { ValidationPipe } from "@nestjs/common";
import { startMetricsServer } from "@app/common";

async function bootstrap() {
  const host = process.env.AUTH_SERVICE_HOST || "localhost";
  const port = parseInt(process.env.AUTH_SERVICE_PORT || "3001", 10);
  const metricsPort = parseInt(process.env.METRICS_PORT || "9091", 10);
  const serviceName = process.env.OTEL_SERVICE_NAME || "auth-service";

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthModule,
    {
      transport: Transport.TCP,
      options: {
        host,
        port,
      },
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Start the dedicated metrics HTTP server for Prometheus scraping
  await startMetricsServer(serviceName, metricsPort);

  await app.listen();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔐 Auth Service running");
  console.log(`📍 TCP: ${host}:${port}`);
  console.log(`📊 Metrics: http://0.0.0.0:${metricsPort}/metrics`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}
bootstrap();
