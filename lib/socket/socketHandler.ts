/**
 * MANEJADOR MODULAR DE WEBSOCKETS
 * 
 * Este archivo centraliza toda la lógica de eventos de Socket.io
 * para mantener el server.js limpio y facilitar el mantenimiento.
 */

import { Server, Socket } from 'socket.io';
import { saveChatMessage, getChatHistory, type MessageData } from '../services/chatService.ts';

interface JoinRoomData {
    roomId: string;
    userId?: string;
}

interface TypingData {
    roomId: string;
    username: string;
    isTyping: boolean;
}

interface LeaveRoomData {
    roomId: string;
    userId?: string;
}

// Extend Socket interface to include custom properties if needed
interface CustomSocket extends Socket {
    currentRoom?: string;
    userId?: string;
    username?: string;
}

/**
 * Configura todos los manejadores de eventos de Socket.io
 * @param {Server} io - Instancia de Socket.io Server
 */
export function setupSocketHandlers(io: Server) {
    // Middleware de autenticación (opcional pero recomendado)
    io.use((socket: CustomSocket, next) => {
        // Aquí puedes validar tokens JWT, cookies, etc.
        const token = socket.handshake.auth.token;

        // Ejemplo: validar token (implementar según tu sistema de auth)
        // if (!token || !validateToken(token)) {
        //   return next(new Error('Autenticación fallida'));
        // }

        // Agregar datos del usuario al socket para uso posterior
        // socket.userId = decodedToken.userId;
        // socket.username = decodedToken.username;

        next();
    });

    // Evento principal: Nueva conexión
    io.on('connection', (socket: CustomSocket) => {
        console.log(`🟢 Cliente conectado: ${socket.id}`);

        // ═══════════════════════════════════════════════════════
        // EVENTO: join_room
        // ═══════════════════════════════════════════════════════
        /**
         * Permite al cliente unirse a una sala específica.
         * Útil para chats privados, salas de soporte, etc.
         */
        socket.on('join_room', async (data: JoinRoomData) => {
            try {
                const { roomId, userId } = data;

                if (!roomId) {
                    socket.emit('error', { message: 'ID de sala requerido' });
                    return;
                }

                // Unirse a la sala
                socket.join(roomId);
                socket.currentRoom = roomId;

                console.log(`👥 Usuario ${socket.id} se unió a la sala: ${roomId}`);

                // Notificar a otros usuarios de la sala
                socket.to(roomId).emit('user_joined', {
                    userId: userId || socket.id,
                    message: 'Un nuevo usuario se ha unido',
                    timestamp: new Date().toISOString()
                });

                // Enviar historial de mensajes al nuevo usuario
                try {
                    const history = await getChatHistory(roomId, 50); // Últimos 50 mensajes
                    socket.emit('chat_history', history);
                } catch (error) {
                    console.error('Error al cargar historial:', error);
                    socket.emit('chat_history', []); // Enviar array vacío si hay error
                }

            } catch (error) {
                console.error('❌ Error en join_room:', error);
                socket.emit('error', { message: 'Error al unirse a la sala' });
            }
        });

        // ═══════════════════════════════════════════════════════
        // EVENTO: send_message
        // ═══════════════════════════════════════════════════════
        /**
         * Recibe un mensaje del cliente, lo persiste en BD y lo broadcast
         */
        socket.on('send_message', async (messageData: MessageData) => {
            try {
                const { userId, roomId, message, username } = messageData;

                // Validaciones
                if (!message || message.trim() === '') {
                    socket.emit('error', { message: 'Mensaje vacío' });
                    return;
                }

                if (!roomId) {
                    socket.emit('error', { message: 'ID de sala requerido' });
                    return;
                }

                // Crear objeto de mensaje enriquecido
                const enrichedMessage = {
                    id: Date.now().toString(), // Temporal, se reemplazará con el ID de BD
                    userId: userId || socket.id,
                    username: username || 'Usuaria Anónima',
                    message: message.trim(),
                    roomId: roomId,
                    timestamp: new Date().toISOString(),
                    socketId: socket.id
                };

                console.log('📨 Mensaje recibido:', enrichedMessage);

                // PERSISTENCIA: Guardar en base de datos (Supabase)
                try {
                    const savedMessage = await saveChatMessage(enrichedMessage);
                    enrichedMessage.id = savedMessage.id; // Usar ID real de BD
                } catch (dbError) {
                    console.error('⚠️  Error al guardar en BD (continuando):', dbError);
                    // Continuar aunque falle la BD (mensajes en tiempo real)
                }

                // BROADCAST: Enviar a todos los usuarios de la sala
                io.to(roomId).emit('receive_message', enrichedMessage);

                // Confirmación al emisor
                socket.emit('message_sent', {
                    success: true,
                    messageId: enrichedMessage.id
                });

            } catch (error) {
                console.error('❌ Error en send_message:', error);
                socket.emit('error', {
                    message: 'Error al enviar mensaje',
                    details: (error as Error).message
                });
            }
        });

        // ═══════════════════════════════════════════════════════
        // EVENTO: typing
        // ═══════════════════════════════════════════════════════
        /**
         * Indicador de "está escribiendo..."
         */
        socket.on('typing', (data: TypingData) => {
            const { roomId, username, isTyping } = data;

            if (!roomId) return;

            // Enviar solo a otros usuarios de la sala (no al emisor)
            socket.to(roomId).emit('user_typing', {
                username: username || 'Alguien',
                isTyping: isTyping
            });
        });

        // ═══════════════════════════════════════════════════════
        // EVENTO: leave_room
        // ═══════════════════════════════════════════════════════
        socket.on('leave_room', (data: LeaveRoomData) => {
            const { roomId, userId } = data;

            if (!roomId) return;

            socket.leave(roomId);
            console.log(`🔴 Usuario ${socket.id} salió de la sala: ${roomId}`);

            // Notificar a otros usuarios
            socket.to(roomId).emit('user_left', {
                userId: userId || socket.id,
                message: 'Un usuario ha salido',
                timestamp: new Date().toISOString()
            });
        });

        // ═══════════════════════════════════════════════════════
        // EVENTO: disconnect
        // ═══════════════════════════════════════════════════════
        socket.on('disconnect', (reason) => {
            console.log(`🔴 Cliente desconectado: ${socket.id} - Razón: ${reason}`);

            // Si estaba en una sala, notificar a otros usuarios
            if (socket.currentRoom) {
                socket.to(socket.currentRoom).emit('user_left', {
                    userId: socket.id,
                    message: 'Un usuario se ha desconectado',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // ═══════════════════════════════════════════════════════
        // EVENTO: error (manejo de errores del socket)
        // ═══════════════════════════════════════════════════════
        socket.on('error', (error) => {
            console.error('❌ Error en socket:', error);
        });
    });

    // Manejo de errores globales de Socket.io
    io.engine.on('connection_error', (err) => {
        console.error('❌ Error de conexión:', err);
    });

    console.log('✅ Manejadores de WebSocket configurados');
}
