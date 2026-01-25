import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy, EventPattern, Payload } from "@nestjs/microservices";
import { SupabaseClient } from "@supabase/supabase-js";
import { NEW_DATABASE } from "../database/database.module";

/**
 * Payload del evento de actualización de perfil
 */
export interface UserProfileUpdatedPayload {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
    syncVersion: number;
}

/**
 * Servicio de User Cache
 *
 * Mantiene sincronizado el cache local de usuarios con Auth Service.
 * Escucha eventos de actualización de perfil via RabbitMQ.
 */
@Injectable()
export class UserCacheService {
    private readonly logger = new Logger(UserCacheService.name);

    constructor(
        @Inject(NEW_DATABASE) private readonly db: SupabaseClient,
    ) {}

    /**
     * Obtener usuario del cache
     */
    async getUser(userId: string): Promise<UserProfileUpdatedPayload | null> {
        const { data, error } = await this.db
            .from("user_cache")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error) {
            if (error.code === "PGRST116") return null;
            this.logger.error(
                `Error obteniendo usuario del cache: ${error.message}`,
            );
            throw error;
        }

        return {
            userId: data.user_id,
            displayName: data.display_name,
            avatarUrl: data.avatar_url,
            role: data.role || "user",
            syncVersion: data.source_version,
        };
    }

    /**
     * Crear o actualizar usuario en el cache
     */
    async upsertUser(payload: UserProfileUpdatedPayload): Promise<void> {
        const { error } = await this.db
            .from("user_cache")
            .upsert({
                user_id: payload.userId,
                display_name: payload.displayName,
                avatar_url: payload.avatarUrl,
                role: payload.role,
                source_version: payload.syncVersion,
                cached_at: new Date().toISOString(),
                is_stale: false,
                is_deleted: false,
            }, {
                onConflict: "user_id",
            });

        if (error) {
            this.logger.error(
                `Error actualizando cache de usuario: ${error.message}`,
            );
            throw error;
        }

        this.logger.debug(`Cache actualizado para usuario: ${payload.userId}`);
    }

    /**
     * Marcar usuario como eliminado en el cache
     */
    async markAsDeleted(userId: string): Promise<void> {
        const { error } = await this.db
            .from("user_cache")
            .update({
                is_deleted: true,
                is_stale: true,
                cached_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

        if (error) {
            this.logger.error(
                `Error marcando usuario como eliminado: ${error.message}`,
            );
            throw error;
        }

        this.logger.log(`Usuario marcado como eliminado en cache: ${userId}`);
    }

    /**
     * Actualizar datos redundantes en posts cuando el usuario cambia su perfil
     */
    async updateRedundantData(
        userId: string,
        displayName: string | null,
        avatarUrl: string | null,
    ): Promise<number> {
        const { data, error } = await this.db
            .from("posts")
            .update({
                author_display_name: displayName,
                author_avatar_url: avatarUrl,
            })
            .eq("author_id", userId)
            .select("id");

        if (error) {
            this.logger.error(
                `Error actualizando datos redundantes: ${error.message}`,
            );
            throw error;
        }

        const count = data?.length || 0;
        this.logger.log(
            `Actualizados ${count} posts con nuevos datos del usuario ${userId}`,
        );
        return count;
    }

    /**
     * Marcar todos los registros de un usuario como stale
     * (después de detectar inconsistencia)
     */
    async markAsStale(userId: string): Promise<void> {
        const { error } = await this.db
            .from("user_cache")
            .update({ is_stale: true })
            .eq("user_id", userId);

        if (error) {
            this.logger.error(
                `Error marcando usuario como stale: ${error.message}`,
            );
        }
    }

    /**
     * Verificar si el cache está actualizado
     */
    async isUpToDate(
        userId: string,
        expectedVersion: number,
    ): Promise<boolean> {
        const cached = await this.getUser(userId);
        if (!cached) return false;
        return cached.syncVersion >= expectedVersion;
    }

    /**
     * Obtener usuarios stale para re-sincronización
     */
    async getStaleUsers(): Promise<string[]> {
        const { data, error } = await this.db
            .from("user_cache")
            .select("user_id")
            .eq("is_stale", true)
            .limit(100);

        if (error) {
            this.logger.error(
                `Error obteniendo usuarios stale: ${error.message}`,
            );
            return [];
        }

        return data.map((u) => u.user_id);
    }
}

/**
 * Subscriber de eventos de perfil de usuario
 *
 * Escucha eventos de Auth Service y actualiza el cache local
 */
@Injectable()
export class UserCacheSubscriber {
    private readonly logger = new Logger(UserCacheSubscriber.name);

    constructor(private readonly userCacheService: UserCacheService) {}

    /**
     * Handler para evento user.profile.updated
     */
    @EventPattern("user.profile.updated")
    async handleProfileUpdated(@Payload() payload: UserProfileUpdatedPayload) {
        this.logger.log(
            `Evento recibido: user.profile.updated para ${payload.userId}`,
        );

        try {
            // Actualizar cache
            await this.userCacheService.upsertUser(payload);

            // Actualizar datos redundantes en posts/comments
            await this.userCacheService.updateRedundantData(
                payload.userId,
                payload.displayName,
                payload.avatarUrl,
            );

            this.logger.log(
                `Cache y datos redundantes actualizados para: ${payload.userId}`,
            );
        } catch (error) {
            this.logger.error(
                `Error procesando actualización: ${(error as Error).message}`,
            );
            // Marcar como stale para retry posterior
            await this.userCacheService.markAsStale(payload.userId);
        }
    }

    /**
     * Handler para evento user.deleted
     */
    @EventPattern("user.deleted")
    async handleUserDeleted(@Payload() payload: { userId: string }) {
        this.logger.log(`Evento recibido: user.deleted para ${payload.userId}`);

        try {
            await this.userCacheService.markAsDeleted(payload.userId);
        } catch (error) {
            this.logger.error(
                `Error procesando eliminación: ${(error as Error).message}`,
            );
        }
    }
}
