import { Injectable, Logger } from "@nestjs/common";
import { PostsService } from "../posts/posts.service";

/**
 * Servicio de Compensación para el Saga Pattern
 *
 * Ejecuta acciones de rollback cuando un paso del Saga falla.
 */
@Injectable()
export class CompensationService {
    private readonly logger = new Logger(CompensationService.name);

    constructor(private readonly postsService: PostsService) {}

    /**
     * Restaurar posts de un usuario (compensación de eliminación)
     */
    async restoreUserPosts(userId: string): Promise<void> {
        this.logger.log(`Restaurando posts para usuario: ${userId}`);

        try {
            const result = await this.postsService.restorePostsByUser(userId);
            this.logger.log(`Posts restaurados: ${result.restoredCount}`);
        } catch (error) {
            this.logger.error(
                `Error restaurando posts: ${(error as Error).message}`,
            );
            throw error;
        }
    }

    /**
     * Registrar fallo de compensación para intervención manual
     */
    async logCompensationFailure(
        userId: string,
        step: string,
        error: string,
    ): Promise<void> {
        this.logger.error(
            `⚠️ COMPENSACIÓN FALLIDA - Requiere intervención manual`,
        );
        this.logger.error(`   Usuario: ${userId}`);
        this.logger.error(`   Paso: ${step}`);
        this.logger.error(`   Error: ${error}`);

        // TODO: Guardar en tabla de fallos para revisión manual
        // TODO: Enviar alerta a administradores
    }
}
