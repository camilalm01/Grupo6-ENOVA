import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ChatGateway } from "./gateways/chat.gateway";
import { ChatService } from "./services/chat.service";
import { SupabaseService } from "./services/supabase.service";
import { EventsModule } from "./events/events.module";
import { IdempotencyService } from "@app/common";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
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
    providers: [ChatGateway, ChatService, SupabaseService, IdempotencyService],
})
export class ChatModule {}
