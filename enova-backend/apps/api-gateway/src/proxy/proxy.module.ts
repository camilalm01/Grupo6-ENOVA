import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ProxyController } from "./proxy.controller";
import { CircuitBreakerService } from "../services/circuit-breaker.service";
import { AggregationService } from "../services/aggregation.service";

@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: "AUTH_SERVICE",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.TCP,
                    options: {
                        host: configService.get<string>("AUTH_SERVICE_HOST") ||
                            "localhost",
                        port: configService.get<number>("AUTH_SERVICE_PORT") ||
                            3001,
                    },
                }),
            },
            {
                name: "COMMUNITY_SERVICE",
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.TCP,
                    options: {
                        host:
                            configService.get<string>(
                                "COMMUNITY_SERVICE_HOST",
                            ) || "localhost",
                        port:
                            configService.get<number>(
                                "COMMUNITY_SERVICE_PORT",
                            ) || 3003,
                    },
                }),
            },
        ]),
    ],
    controllers: [ProxyController],
    providers: [CircuitBreakerService, AggregationService],
})
export class ProxyModule {}
