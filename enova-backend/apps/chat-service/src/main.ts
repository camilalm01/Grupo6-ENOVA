import { NestFactory } from "@nestjs/core";
import { ChatModule } from "./chat.module";
import { RedisIoAdapter } from "./adapters/redis-io.adapter";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
    const app = await NestFactory.create(ChatModule);
    const configService = app.get(ConfigService);

    // Configurar Redis Adapter para escalabilidad horizontal
    const redisHost = configService.get<string>("REDIS_HOST") || "localhost";
    const redisPort = configService.get<number>("REDIS_PORT") || 6379;

    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis(redisHost, redisPort);
    app.useWebSocketAdapter(redisIoAdapter);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        }),
    );

    // CORS para WebSockets
    app.enableCors({
        origin: configService.get<string>("ALLOWED_ORIGINS")?.split(",") || [
            "http://localhost:3000",
        ],
        credentials: true,
    });

    const port = configService.get<number>("CHAT_SERVICE_PORT") || 3002;
    await app.listen(port);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💬 Chat Service running");
    console.log(`📍 HTTP: http://localhost:${port}`);
    console.log(`🔌 WebSocket: ws://localhost:${port}/socket.io`);
    console.log(`📡 Redis: ${redisHost}:${redisPort}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}
bootstrap();
