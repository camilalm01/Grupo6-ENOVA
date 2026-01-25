import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ProfileService } from "./profile/profile.service";
import { UpdateProfileDto } from "./profile/dto/update-profile.dto";
import { UserEventsPublisher } from "./events/publishers/user-events.publisher";

interface GetProfilePayload {
    userId: string;
}

interface UpdateProfilePayload extends UpdateProfileDto {
    userId: string;
}

interface DeleteAccountPayload {
    userId: string;
    email: string;
}

@Controller()
export class AuthController {
    constructor(
        private readonly profileService: ProfileService,
        private readonly userEventsPublisher: UserEventsPublisher,
    ) {}

    /**
     * Obtener perfil de usuario
     */
    @MessagePattern({ cmd: "get_profile" })
    async getProfile(@Payload() data: GetProfilePayload) {
        return this.profileService.getProfile(data.userId);
    }

    /**
     * Actualizar perfil de usuario
     */
    @MessagePattern({ cmd: "update_profile" })
    async updateProfile(@Payload() data: UpdateProfilePayload) {
        const { userId, ...updateData } = data;
        return this.profileService.updateProfile(userId, updateData);
    }

    /**
     * Validar existencia de usuario
     */
    @MessagePattern({ cmd: "validate_user" })
    async validateUser(@Payload() data: GetProfilePayload) {
        return this.profileService.validateUser(data.userId);
    }

    /**
     * Eliminar cuenta de usuario - INICIA EL SAGA
     *
     * 1. Marca el perfil como eliminado
     * 2. Publica evento user.deleted a RabbitMQ
     * 3. Community Service y Chat Service reaccionan al evento
     */
    @MessagePattern({ cmd: "delete_account" })
    async deleteAccount(@Payload() data: DeleteAccountPayload) {
        const { userId, email } = data;

        try {
            // Paso 1: Marcar perfil como eliminado (soft delete)
            await this.profileService.markAsDeleted(userId);

            // Paso 2: Publicar evento para iniciar Saga
            await this.userEventsPublisher.publishUserDeleted({
                userId,
                email,
                deletedAt: new Date().toISOString(),
                reason: "User requested account deletion",
            });

            return {
                success: true,
                message:
                    "Account deletion initiated. All your data will be removed shortly.",
                userId,
            };
        } catch (error) {
            // Rollback: restaurar perfil si falló
            await this.profileService.restoreProfile(userId);

            throw error;
        }
    }
}
