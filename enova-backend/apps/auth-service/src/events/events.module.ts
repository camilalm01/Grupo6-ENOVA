import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { UserEventsPublisher } from "./publishers/user-events.publisher";

@Module({
    imports: [
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
                        queue: "auth_events",
                        queueOptions: {
                            durable: true,
                        },
                    },
                }),
            },
        ]),
    ],
    providers: [UserEventsPublisher],
    exports: [UserEventsPublisher],
})
export class EventsModule {}
