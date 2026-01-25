import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";
import { ChatMessage, MessageData } from "../interfaces/message.interface";

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(private readonly supabaseService: SupabaseService) {}

    /**
     * Guarda un mensaje en la base de datos
     */
    async saveChatMessage(messageData: MessageData): Promise<ChatMessage> {
        const { userId, message, roomId, username } = messageData;

        if (!userId || !message || !roomId) {
            throw new Error(
                "Datos incompletos: userId, message y roomId son requeridos",
            );
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .insert([
                {
                    user_id: userId,
                    content: message,
                    room_id: roomId,
                    username: username || null,
                    created_at: new Date().toISOString(),
                },
            ])
            .select()
            .single();

        if (error) {
            this.logger.error(
                `Error de Supabase al guardar mensaje: ${error.message}`,
            );
            throw error;
        }

        this.logger.debug(`Mensaje guardado en BD: ${data.id}`);
        return data as ChatMessage;
    }

    /**
     * Obtiene el historial de mensajes de una sala
     */
    async getChatHistory(
        roomId: string,
        limit: number = 50,
    ): Promise<ChatMessage[]> {
        if (!roomId) {
            throw new Error("roomId es requerido");
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            this.logger.error(
                `Error de Supabase al obtener historial: ${error.message}`,
            );
            throw error;
        }

        // Invertir orden para mostrar más antiguos primero
        return (data as ChatMessage[]).reverse();
    }

    /**
     * Elimina un mensaje (para moderación)
     */
    async deleteMessage(messageId: string, userId: string): Promise<boolean> {
        // Verificar que el mensaje pertenece al usuario
        const { data: message, error: fetchError } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .select("user_id")
            .eq("id", messageId)
            .single();

        if (fetchError) {
            throw fetchError;
        }

        // TODO: Agregar validación de rol de admin/moderador
        if (message.user_id !== userId) {
            throw new Error("No autorizado para eliminar este mensaje");
        }

        const { error } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .delete()
            .eq("id", messageId);

        if (error) {
            throw error;
        }

        this.logger.log(`Mensaje eliminado: ${messageId}`);
        return true;
    }

    /**
     * Actualiza el estado de un mensaje (ej: marcar como leído)
     */
    async updateMessageStatus(
        messageId: string,
        updates: Partial<ChatMessage>,
    ): Promise<ChatMessage> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .update(updates)
            .eq("id", messageId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as ChatMessage;
    }

    /**
     * Obtiene mensajes no leídos de un usuario en una sala
     */
    async getUnreadCount(roomId: string, userId: string): Promise<number> {
        try {
            const { count, error } = await this.supabaseService
                .getClient()
                .from("chat_messages")
                .select("*", { count: "exact", head: true })
                .eq("room_id", roomId)
                .neq("user_id", userId)
                .is("read_at", null);

            if (error) {
                throw error;
            }

            return count || 0;
        } catch (error) {
            this.logger.error(
                `Error en getUnreadCount: ${(error as Error).message}`,
            );
            return 0;
        }
    }

    /**
     * Marcar mensajes como leídos
     */
    async markMessagesAsRead(roomId: string, userId: string): Promise<void> {
        const { error } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .update({ read_at: new Date().toISOString() })
            .eq("room_id", roomId)
            .neq("user_id", userId)
            .is("read_at", null);

        if (error) {
            this.logger.error(
                `Error al marcar mensajes como leídos: ${error.message}`,
            );
            throw error;
        }
    }

    /**
     * Anonimizar mensajes de un usuario (para Saga de eliminación de cuenta)
     * En lugar de eliminar, cambiamos el username a "Usuario eliminado"
     */
    async anonymizeUserMessages(
        userId: string,
    ): Promise<{ anonymizedCount: number }> {
        // Contar mensajes a anonimizar
        const { count } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        // Anonimizar: cambiar username y marcar como anonimizado
        const { error } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .update({
                username: "Usuaria eliminada",
                anonymized_at: new Date().toISOString(),
                original_user_id: userId, // Guardar referencia por si se necesita
            })
            .eq("user_id", userId);

        if (error) {
            this.logger.error(`Error anonimizando mensajes: ${error.message}`);
            throw error;
        }

        this.logger.log(
            `Mensajes anonimizados para usuario ${userId}: ${count || 0}`,
        );
        return { anonymizedCount: count || 0 };
    }

    /**
     * Restaurar mensajes anonimizados (compensación de Saga)
     */
    async restoreUserMessages(
        userId: string,
    ): Promise<{ restoredCount: number }> {
        // Contar mensajes a restaurar
        const { count } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("original_user_id", userId);

        // Restaurar: quitar anonimización
        const { error } = await this.supabaseService
            .getClient()
            .from("chat_messages")
            .update({
                anonymized_at: null,
                // No restauramos el username original ya que no lo guardamos
            })
            .eq("original_user_id", userId);

        if (error) {
            this.logger.error(`Error restaurando mensajes: ${error.message}`);
            throw error;
        }

        this.logger.log(
            `Mensajes restaurados para usuario ${userId}: ${count || 0}`,
        );
        return { restoredCount: count || 0 };
    }
}
