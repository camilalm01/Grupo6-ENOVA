/**
 * SERVICIO DE CHAT CON SUPABASE
 * 
 * Este módulo maneja toda la lógica de persistencia de mensajes
 * en la base de datos de Supabase (PostgreSQL).
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ⚠️ Usar Service Role en backend

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno de Supabase no configuradas');
  console.error('   Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
}

// Crear cliente de Supabase con privilegios de servicio
const supabase: SupabaseClient = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export interface MessageData {
  userId: string;
  message: string;
  roomId: string;
  username?: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  room_id: string;
  username: string | null;
  created_at: string;
  read_at?: string | null;
  deleted_at?: string | null;
}

/**
 * Guarda un mensaje en la base de datos
 */
export async function saveChatMessage(messageData: MessageData): Promise<ChatMessage> {
  try {
    const { userId, message, roomId, username } = messageData;

    // Validaciones
    if (!userId || !message || !roomId) {
      throw new Error('Datos incompletos: userId, message y roomId son requeridos');
    }

    // Insertar en la tabla chat_messages
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          user_id: userId,
          content: message,
          room_id: roomId,
          username: username || null,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error de Supabase al guardar mensaje:', error);
      throw error;
    }

    console.log('✅ Mensaje guardado en BD:', data.id);
    return data as ChatMessage;

  } catch (error) {
    console.error('❌ Error en saveChatMessage:', error);
    throw error;
  }
}

/**
 * Obtiene el historial de mensajes de una sala
 */
export async function getChatHistory(roomId: string, limit: number = 50): Promise<ChatMessage[]> {
  try {
    if (!roomId) {
      throw new Error('roomId es requerido');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error de Supabase al obtener historial:', error);
      throw error;
    }

    // Invertir orden para mostrar más antiguos primero
    return (data as ChatMessage[]).reverse();

  } catch (error) {
    console.error('❌ Error en getChatHistory:', error);
    throw error;
  }
}

/**
 * Elimina un mensaje (para moderación)
 */
export async function deleteMessage(messageId: string, userId: string): Promise<boolean> {
  try {
    // Verificar que el mensaje pertenece al usuario o es admin
    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select('user_id')
      .eq('id', messageId)
      .single();

    if (fetchError) throw fetchError;

    // TODO: Agregar validación de rol de admin
    if (message.user_id !== userId) {
      throw new Error('No autorizado para eliminar este mensaje');
    }

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;

    console.log('🗑️  Mensaje eliminado:', messageId);
    return true;

  } catch (error) {
    console.error('❌ Error en deleteMessage:', error);
    throw error;
  }
}

/**
 * Actualiza el estado de un mensaje (ej: marcar como leído)
 */
export async function updateMessageStatus(messageId: string, updates: Partial<ChatMessage>): Promise<ChatMessage> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .update(updates)
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;

    return data as ChatMessage;

  } catch (error) {
    console.error('❌ Error en updateMessageStatus:', error);
    throw error;
  }
}

/**
 * Obtiene mensajes no leídos de un usuario en una sala
 */
export async function getUnreadCount(roomId: string, userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .neq('user_id', userId)
      .is('read_at', null);

    if (error) throw error;

    return count || 0;

  } catch (error) {
    console.error('❌ Error en getUnreadCount:', error);
    return 0;
  }
}
