import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ChatService } from "../services/chat.service";
import { JoinRoomDto } from "../dto/join-room.dto";
import { SendMessageDto } from "../dto/send-message.dto";
import { TypingDto } from "../dto/typing.dto";
import { Logger, UsePipes, ValidationPipe } from "@nestjs/common";
import { WsAuthService, WsAuthUser } from "../auth/ws-auth.service";

interface CustomSocket extends Socket {
    currentRoom?: string;
    userId?: string;
    username?: string;
    user?: WsAuthUser;
    authenticated?: boolean;
}

@WebSocketGateway({
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(",") ||
            ["http://localhost:3000"],
        credentials: true,
    },
    path: "/socket.io",
})
@UsePipes(new ValidationPipe({ transform: true }))
export class ChatGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly chatService: ChatService,
        private readonly wsAuthService: WsAuthService,
    ) {}

    // ═══════════════════════════════════════════════════════════
    // LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════════

    afterInit() {
        this.logger.log("WebSocket Gateway inicializado con autenticación JWT");
    }

    async handleConnection(client: CustomSocket) {
        this.logger.log(`🔌 Conexión entrante: ${client.id}`);

        // Extraer token del handshake
        const token = this.wsAuthService.extractToken(client);

        if (!token) {
            this.logger.warn(`❌ Conexión rechazada (sin token): ${client.id}`);
            client.emit("error", {
                code: "AUTH_REQUIRED",
                message: "Token de autenticación requerido",
            });
            client.disconnect(true);
            return;
        }

        // Validar token JWT
        const authResult = await this.wsAuthService.validateToken(token);

        if (!authResult.valid || !authResult.user) {
            this.logger.warn(
                `❌ Conexión rechazada (token inválido): ${client.id} - ${authResult.error}`,
            );
            client.emit("error", {
                code: "AUTH_FAILED",
                message: authResult.error || "Token inválido",
            });
            client.disconnect(true);
            return;
        }

        // Autenticación exitosa - guardar datos del usuario
        client.user = authResult.user;
        client.userId = authResult.user.id;
        client.username = authResult.user.displayName ||
            authResult.user.email || "Usuaria";
        client.authenticated = true;

        this.logger.log(
            `🟢 Cliente autenticado: ${client.id} (Usuario: ${client.userId})`,
        );

        // Emitir confirmación de conexión
        client.emit("connected", {
            userId: client.userId,
            username: client.username,
            message: "Conexión autenticada exitosamente",
        });
    }

    handleDisconnect(client: CustomSocket) {
        this.logger.log(
            `🔴 Cliente desconectado: ${client.id} (Usuario: ${
                client.userId || "no autenticado"
            })`,
        );

        // Notificar a la sala si estaba en una
        if (client.currentRoom) {
            this.server.to(client.currentRoom).emit("user_left", {
                userId: client.userId || client.id,
                username: client.username,
                message: "Un usuario se ha desconectado",
                timestamp: new Date().toISOString(),
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // EVENTO: join_room
    // ═══════════════════════════════════════════════════════════
    @SubscribeMessage("join_room")
    async handleJoinRoom(
        @MessageBody() data: JoinRoomDto,
        @ConnectedSocket() client: CustomSocket,
    ) {
        try {
            // Verificar que el cliente esté autenticado
            if (!client.authenticated || !client.userId) {
                client.emit("error", {
                    code: "NOT_AUTHENTICATED",
                    message: "Debes estar autenticado para unirte a una sala",
                });
                return { success: false, error: "No autenticado" };
            }

            const { roomId } = data;

            // Verificar permisos de acceso a la sala
            const canAccess = await this.wsAuthService.canAccessRoom(
                client.userId,
                roomId,
            );
            if (!canAccess) {
                this.logger.warn(
                    `Usuario ${client.userId} sin acceso a sala ${roomId}`,
                );
                client.emit("error", {
                    code: "ROOM_ACCESS_DENIED",
                    message: "No tienes permiso para acceder a esta sala",
                });
                return { success: false, error: "Acceso denegado" };
            }

            // Salir de sala anterior si existe
            if (client.currentRoom) {
                client.leave(client.currentRoom);
                client.to(client.currentRoom).emit("user_left", {
                    userId: client.userId,
                    username: client.username,
                    timestamp: new Date().toISOString(),
                });
            }

            // Unirse a la nueva sala
            client.join(roomId);
            client.currentRoom = roomId;

            this.logger.log(
                `👥 Usuario ${client.userId} (${client.username}) se unió a sala: ${roomId}`,
            );

            // Notificar a otros usuarios de la sala
            client.to(roomId).emit("user_joined", {
                userId: client.userId,
                username: client.username,
                message: "Un nuevo usuario se ha unido",
                timestamp: new Date().toISOString(),
            });

            // Cargar historial de mensajes
            try {
                const history = await this.chatService.getChatHistory(
                    roomId,
                    50,
                );
                client.emit("chat_history", history);
            } catch (error) {
                this.logger.error(
                    `Error al cargar historial: ${(error as Error).message}`,
                );
                client.emit("chat_history", []);
            }

            return { success: true, roomId };
        } catch (error) {
            this.logger.error(
                `Error en join_room: ${(error as Error).message}`,
            );
            client.emit("error", { message: "Error al unirse a la sala" });
            return { success: false, error: (error as Error).message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // EVENTO: send_message
    // ═══════════════════════════════════════════════════════════
    @SubscribeMessage("send_message")
    async handleSendMessage(
        @MessageBody() data: SendMessageDto,
        @ConnectedSocket() client: CustomSocket,
    ) {
        try {
            const { userId, roomId, message, username, clientMessageId } = data;

            // Validación básica
            if (!message || message.trim() === "") {
                client.emit("error", { message: "Mensaje vacío" });
                return { success: false, error: "Mensaje vacío" };
            }

            if (!roomId) {
                client.emit("error", { message: "ID de sala requerido" });
                return { success: false, error: "ID de sala requerido" };
            }

            // Crear mensaje enriquecido
            const enrichedMessage = {
                id: Date.now().toString(),
                userId: userId || client.userId || client.id,
                username: username || client.username || "Usuaria Anónima",
                message: message.trim(),
                roomId,
                timestamp: new Date().toISOString(),
                socketId: client.id,
                clientMessageId,
            };

            this.logger.log(`📨 Mensaje recibido en sala ${roomId}`);

            // Persistir en Supabase
            try {
                const savedMessage = await this.chatService.saveChatMessage({
                    userId: enrichedMessage.userId,
                    message: enrichedMessage.message,
                    roomId: enrichedMessage.roomId,
                    username: enrichedMessage.username,
                });
                enrichedMessage.id = savedMessage.id;
            } catch (dbError) {
                this.logger.warn(
                    `Error al guardar en BD: ${(dbError as Error).message}`,
                );
                // Continuar sin persistencia - mensajes en tiempo real
            }

            // Broadcast a todos en la sala (incluyendo el emisor)
            this.server.to(roomId).emit("receive_message", enrichedMessage);

            // Confirmación al emisor
            client.emit("message_sent", {
                success: true,
                messageId: enrichedMessage.id,
                clientMessageId,
            });

            return { success: true, messageId: enrichedMessage.id };
        } catch (error) {
            this.logger.error(
                `Error en send_message: ${(error as Error).message}`,
            );
            client.emit("error", { message: "Error al enviar mensaje" });
            return { success: false, error: (error as Error).message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // EVENTO: typing
    // ═══════════════════════════════════════════════════════════
    @SubscribeMessage("typing")
    handleTyping(
        @MessageBody() data: TypingDto,
        @ConnectedSocket() client: CustomSocket,
    ) {
        const { roomId, username, isTyping } = data;

        if (!roomId) return;

        // Enviar solo a otros usuarios de la sala (no al emisor)
        client.to(roomId).emit("user_typing", {
            userId: client.userId || client.id,
            username: username || client.username || "Alguien",
            isTyping,
        });
    }

    // ═══════════════════════════════════════════════════════════
    // EVENTO: leave_room
    // ═══════════════════════════════════════════════════════════
    @SubscribeMessage("leave_room")
    handleLeaveRoom(
        @MessageBody() data: { roomId: string; userId?: string },
        @ConnectedSocket() client: CustomSocket,
    ) {
        const { roomId, userId } = data;

        if (!roomId) return;

        client.leave(roomId);
        client.currentRoom = undefined;

        this.logger.log(`🔴 Usuario ${client.id} salió de la sala: ${roomId}`);

        // Notificar a otros usuarios
        client.to(roomId).emit("user_left", {
            userId: userId || client.userId || client.id,
            message: "Un usuario ha salido",
            timestamp: new Date().toISOString(),
        });
    }

    // ═══════════════════════════════════════════════════════════
    // EVENTO: get_room_users (opcional - para mostrar usuarios online)
    // ═══════════════════════════════════════════════════════════
    @SubscribeMessage("get_room_users")
    async handleGetRoomUsers(
        @MessageBody() data: { roomId: string },
        @ConnectedSocket() client: CustomSocket,
    ) {
        const { roomId } = data;

        if (!roomId) return { users: [] };

        const sockets = await this.server.in(roomId).fetchSockets();
        const users = sockets.map((socket) => ({
            id: (socket as unknown as CustomSocket).userId || socket.id,
            username: (socket as unknown as CustomSocket).username,
        }));

        return { users };
    }
}
