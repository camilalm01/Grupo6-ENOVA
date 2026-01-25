import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AuthModule } from "./auth.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
    const host = process.env.AUTH_SERVICE_HOST || "localhost";
    const port = parseInt(process.env.AUTH_SERVICE_PORT || "3001", 10);

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

    await app.listen();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔐 Auth Service running");
    console.log(`📍 TCP: ${host}:${port}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}
bootstrap();
