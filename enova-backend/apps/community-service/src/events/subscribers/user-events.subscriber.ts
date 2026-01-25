import { Inject, Injectable, Logger } from "@nestjs/common";
import {
    ClientProxy,
    Ctx,
    EventPattern,
    Payload,
    RmqContext,
} from "@nestjs/microservices";
import { PostsService } from "../../posts/posts.service";
import { CompensationService } from "../../saga/compensation.service";
import { IdempotencyService } from "@app/common";
import {
    createUserDeletionFailedEvent,
    createUserPostsDeletedEvent,
    USER_EVENTS,
    UserDeletedEvent,
} from "@app/common";

/**
 * Subscriber de eventos de usuario para el Saga de eliminación
 *
 * Escucha el evento user.deleted y elimina los posts del usuario.
 * Si falla, emite un evento de compensación.
 */
@Injectable()
export class UserEventsSubscriber {
    private readonly logger = new Logger(UserEventsSubscriber.name);

    constructor(
        private readonly postsService: PostsService,
        private readonly compensationService: CompensationService,
        private readonly idempotencyService: IdempotencyService,
        @Inject("RABBITMQ_SERVICE") private readonly rabbitClient: ClientProxy,
    ) {}

    /**
     * Maneja el evento user.deleted
     * Parte del Saga: elimina todos los posts del usuario
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
            // Verificar idempotencia - evitar procesamiento duplicado
            const canProcess = await this.idempotencyService.tryProcess(
                event.eventId,
            );
            if (!canProcess) {
                this.logger.warn(`Evento duplicado ignorado: ${event.eventId}`);
                channel.ack(originalMsg);
                return;
            }

            const { userId, email } = event.payload;
            this.logger.log(
                `Procesando eliminación de posts para usuario: ${userId}`,
            );

            // Eliminar todos los posts del usuario
            const result = await this.postsService.deletePostsByUser(userId);

            this.logger.log(
                `✅ Posts eliminados: ${result.deletedCount} para usuario ${userId}`,
            );

            // Emitir evento de éxito
            const successEvent = createUserPostsDeletedEvent(
                {
                    userId,
                    postCount: result.deletedCount,
                    deletedAt: new Date().toISOString(),
                },
                event.metadata.correlationId,
            );

            this.rabbitClient.emit(
                USER_EVENTS.USER_POSTS_DELETED,
                successEvent,
            );
            this.logger.log(
                `📤 Evento emitido: ${USER_EVENTS.USER_POSTS_DELETED}`,
            );

            // ACK del mensaje
            channel.ack(originalMsg);
        } catch (error) {
            this.logger.error(
                `❌ Error procesando evento: ${(error as Error).message}`,
            );

            // Emitir evento de fallo para compensación
            const failedEvent = createUserDeletionFailedEvent(
                {
                    userId: event.payload.userId,
                    failedStep: "community",
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

            // NACK para requeue (con delay si es posible)
            channel.nack(originalMsg, false, true);
        }
    }

    /**
     * Maneja el evento de fallo del Chat Service
     * Ejecuta compensación: restaurar posts eliminados
     */
    @EventPattern(USER_EVENTS.USER_DELETION_FAILED)
    async handleDeletionFailed(
        @Payload() event: any,
        @Ctx() context: RmqContext,
    ) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        // Solo procesar si el fallo fue en chat (después de community)
        if (event.payload.failedStep !== "chat") {
            channel.ack(originalMsg);
            return;
        }

        const canProcess = await this.idempotencyService.tryProcess(
            `compensation-${event.eventId}`,
        );
        if (!canProcess) {
            channel.ack(originalMsg);
            return;
        }

        try {
            this.logger.warn(
                `🔄 Ejecutando compensación para usuario: ${event.payload.userId}`,
            );

            // Restaurar posts
            await this.compensationService.restoreUserPosts(
                event.payload.userId,
            );

            this.logger.log(
                `✅ Compensación completada para usuario: ${event.payload.userId}`,
            );
            channel.ack(originalMsg);
        } catch (error) {
            this.logger.error(
                `❌ Error en compensación: ${(error as Error).message}`,
            );
            // En caso de error en compensación, requiere intervención manual
            channel.ack(originalMsg); // ACK para evitar loop infinito
        }
    }
}
