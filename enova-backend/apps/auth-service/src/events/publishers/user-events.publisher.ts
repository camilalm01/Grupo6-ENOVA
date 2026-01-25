import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { createUserDeletedEvent, UserDeletedPayload } from "@app/common";

/**
 * Publisher de eventos de usuario
 *
 * Publica eventos de dominio a RabbitMQ para que otros servicios
 * puedan reaccionar (Saga Choreography).
 */
@Injectable()
export class UserEventsPublisher {
    private readonly logger = new Logger(UserEventsPublisher.name);

    constructor(
        @Inject("RABBITMQ_SERVICE") private readonly rabbitClient: ClientProxy,
    ) {}

    /**
     * Publica evento de usuario eliminado
     * Inicia el Saga de eliminación de cuenta
     */
    async publishUserDeleted(payload: UserDeletedPayload): Promise<void> {
        const event = createUserDeletedEvent(payload);

        this.logger.log(
            `📤 Publicando evento: user.deleted para usuario ${payload.userId}`,
        );
        this.logger.debug(`   EventId: ${event.eventId}`);
        this.logger.debug(`   CorrelationId: ${event.metadata.correlationId}`);

        try {
            // Emit es fire-and-forget, ideal para eventos
            this.rabbitClient.emit("user.deleted", event);
            this.logger.log(`✅ Evento publicado exitosamente`);
        } catch (error) {
            this.logger.error(
                `❌ Error publicando evento: ${(error as Error).message}`,
            );
            throw error;
        }
    }

    /**
     * Publica evento de usuario restaurado (compensación completada)
     */
    async publishUserRestored(userId: string): Promise<void> {
        const event = {
            eventType: "user.restored",
            payload: {
                userId,
                restoredAt: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
        };

        this.logger.log(
            `📤 Publicando evento: user.restored para usuario ${userId}`,
        );
        this.rabbitClient.emit("user.restored", event);
    }
}
