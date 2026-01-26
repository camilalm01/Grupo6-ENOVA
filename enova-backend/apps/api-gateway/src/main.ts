import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Configuración global de validación
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS para Next.js frontend
  app.enableCors({
    origin: configService.get<string>("ALLOWED_ORIGINS")?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  });

  const port = configService.get<number>("GATEWAY_PORT") || 3000;
  await app.listen(port);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 API Gateway running");
  console.log(`📍 HTTP: http://localhost:${port}`);
  console.log(`📊 Metrics: http://localhost:${port}/metrics`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}
bootstrap();
