import { Inject, Injectable, Logger } from "@nestjs/common";
import {
    ClientProxy,
    Ctx,
    EventPattern,
    Payload,
    RmqContext,
} from "@nestjs/microservices";
import { ChatService } from "../../services/chat.service";
import { IdempotencyService } from "@app/common";
import {
    createUserDeletionFailedEvent,
    createUserMessagesAnonymizedEvent,
    USER_EVENTS,
    UserDeletedEvent,
} from "@app/common";

/**
 * Subscriber de eventos de usuario para el Chat Service
 *
 * Escucha el evento user.deleted y anonimiza los mensajes del usuario.
 */
@Injectable()
export class UserEventsSubscriber {
    private readonly logger = new Logger(UserEventsSubscriber.name);

    constructor(
        private readonly chatService: ChatService,
        private readonly idempotencyService: IdempotencyService,
        @Inject("RABBITMQ_SERVICE") private readonly rabbitClient: ClientProxy,
    ) {}

    /**
     * Maneja el evento user.deleted
     * Anonimiza todos los mensajes del usuario
     */
    @EventPattern(USER_EVENTS.USER_DELETED)
    async handleUserDeleted(
        @Payload() event: UserDeletedEvent,
        @Ctx() context: RmqContext,
    ) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        this.logger.log(
            `📥 Evento recibido: ${event.eventType} - EventId: ${event.eventId}`,
        );

        try {
            // Verificar idempotencia
            const canProcess = await this.idempotencyService.tryProcess(
                event.eventId,
            );
            if (!canProcess) {
                this.logger.warn(`Evento duplicado ignorado: ${event.eventId}`);
                channel.ack(originalMsg);
                return;
            }

            const { userId } = event.payload;
            this.logger.log(
                `Procesando anonimización de mensajes para usuario: ${userId}`,
            );

            // Anonimizar mensajes del usuario
            const result = await this.chatService.anonymizeUserMessages(userId);

            this.logger.log(
                `✅ Mensajes anonimizados: ${result.anonymizedCount} para usuario ${userId}`,
            );

            // Emitir evento de éxito
            const successEvent = createUserMessagesAnonymizedEvent(
                {
                    userId,
                    messageCount: result.anonymizedCount,
                    anonymizedAt: new Date().toISOString(),
                },
                event.metadata.correlationId,
            );

            this.rabbitClient.emit(
                USER_EVENTS.USER_MESSAGES_ANONYMIZED,
                successEvent,
            );
            this.logger.log(
                `📤 Evento emitido: ${USER_EVENTS.USER_MESSAGES_ANONYMIZED}`,
            );

            // ACK del mensaje
            channel.ack(originalMsg);
        } catch (error) {
            this.logger.error(
                `❌ Error procesando evento: ${(error as Error).message}`,
            );

            // Emitir evento de fallo - esto triggerará compensación en Community y Auth
            const failedEvent = createUserDeletionFailedEvent(
                {
                    userId: event.payload.userId,
                    failedStep: "chat",
                    reason: (error as Error).message,
                    originalEvent: event,
                },
                event.metadata.correlationId,
            );

            this.rabbitClient.emit(
                USER_EVENTS.USER_DELETION_FAILED,
                failedEvent,
            );
            this.logger.log(
                `📤 Evento de fallo emitido: ${USER_EVENTS.USER_DELETION_FAILED}`,
            );

            // Remover marca de idempotencia para permitir reintento
            await this.idempotencyService.removeProcessedMark(event.eventId);

            // NACK para requeue
            channel.nack(originalMsg, false, true);
        }
    }
}
