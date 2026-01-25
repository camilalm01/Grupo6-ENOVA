import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

export interface UserProfile {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

@Injectable()
export class ProfileService {
    private readonly logger = new Logger(ProfileService.name);

    constructor(private readonly supabaseService: SupabaseService) {}

    /**
     * Obtener perfil de usuario por ID
     */
    async getProfile(userId: string): Promise<UserProfile> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .is("deleted_at", null)
            .single();

        if (error || !data) {
            throw new NotFoundException(
                `Perfil no encontrado para usuario: ${userId}`,
            );
        }

        return data as UserProfile;
    }

    /**
     * Actualizar perfil de usuario
     */
    async updateProfile(
        userId: string,
        updateData: UpdateProfileDto,
    ): Promise<UserProfile> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from("profiles")
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
            })
            .eq("id", userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Error al actualizar perfil: ${error.message}`);
        }

        this.logger.log(`Perfil actualizado para usuario: ${userId}`);
        return data as UserProfile;
    }

    /**
     * Validar existencia de usuario
     */
    async validateUser(
        userId: string,
    ): Promise<{ valid: boolean; user?: UserProfile }> {
        try {
            const profile = await this.getProfile(userId);
            return { valid: true, user: profile };
        } catch {
            return { valid: false };
        }
    }

    /**
     * Crear perfil para nuevo usuario (trigger desde Supabase Auth)
     */
    async createProfile(userId: string, email: string): Promise<UserProfile> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from("profiles")
            .insert([
                {
                    id: userId,
                    email,
                    display_name: null,
                    avatar_url: null,
                    bio: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            ])
            .select()
            .single();

        if (error) {
            throw new Error(`Error al crear perfil: ${error.message}`);
        }

        this.logger.log(`Perfil creado para usuario: ${userId}`);
        return data as UserProfile;
    }

    /**
     * Marcar perfil como eliminado (soft delete) - Paso 1 del Saga
     */
    async markAsDeleted(userId: string): Promise<void> {
        const { error } = await this.supabaseService
            .getClient()
            .from("profiles")
            .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (error) {
            throw new Error(
                `Error al marcar perfil como eliminado: ${error.message}`,
            );
        }

        this.logger.log(`Perfil marcado como eliminado: ${userId}`);
    }

    /**
     * Restaurar perfil (compensación del Saga)
     */
    async restoreProfile(userId: string): Promise<void> {
        const { error } = await this.supabaseService
            .getClient()
            .from("profiles")
            .update({
                deleted_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (error) {
            throw new Error(`Error al restaurar perfil: ${error.message}`);
        }

        this.logger.log(`Perfil restaurado: ${userId}`);
    }
}
