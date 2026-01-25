import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { CommunityModule } from "./community.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
    const host = process.env.COMMUNITY_SERVICE_HOST || "localhost";
    const port = parseInt(process.env.COMMUNITY_SERVICE_PORT || "3003", 10);

    // Crear microservicio TCP
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        CommunityModule,
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
    console.log("🏘️  Community Service running");
    console.log(`📍 TCP: ${host}:${port}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // También conectar a RabbitMQ para eventos
    const rmqApp = await NestFactory.createMicroservice<MicroserviceOptions>(
        CommunityModule,
        {
            transport: Transport.RMQ,
            options: {
                urls: [
                    process.env.RABBITMQ_URL ||
                    "amqp://enova:enova_secret@localhost:5672",
                ],
                queue: process.env.RABBITMQ_QUEUE_COMMUNITY ||
                    "community_events",
                queueOptions: {
                    durable: true,
                },
            },
        },
    );

    await rmqApp.listen();
    console.log("📡 RabbitMQ: Conectado a cola community_events");
}
bootstrap();
