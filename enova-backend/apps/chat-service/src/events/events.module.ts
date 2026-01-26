import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { UserEventsSubscriber } from "./subscribers/user-events.subscriber";
import { ChatService } from "../services/chat.service";
import { SupabaseService } from "../services/supabase.service";
import { IdempotencyService } from "@app/common";

@Module({
    imports: [
        ConfigModule,
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
    ],
    providers: [
        UserEventsSubscriber,
        ChatService,
        SupabaseService,
        IdempotencyService,
    ],
    exports: [UserEventsSubscriber],
})
export class EventsModule {}
