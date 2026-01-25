/**
 * Constantes de eventos de WebSocket
 * Usar estas constantes en lugar de strings para evitar typos
 */
export const SOCKET_EVENTS = {
    // Eventos del cliente al servidor
    JOIN_ROOM: "join_room",
    LEAVE_ROOM: "leave_room",
    SEND_MESSAGE: "send_message",
    TYPING: "typing",
    GET_ROOM_USERS: "get_room_users",

    // Eventos del servidor al cliente
    USER_JOINED: "user_joined",
    USER_LEFT: "user_left",
    USER_TYPING: "user_typing",
    RECEIVE_MESSAGE: "receive_message",
    MESSAGE_SENT: "message_sent",
    CHAT_HISTORY: "chat_history",
    ERROR: "error",
} as const;

/**
 * Patrones de mensajes para comunicación inter-servicios (TCP/gRPC)
 */
export const MESSAGE_PATTERNS = {
    // Auth Service
    GET_PROFILE: { cmd: "get_profile" },
    UPDATE_PROFILE: { cmd: "update_profile" },
    VALIDATE_USER: { cmd: "validate_user" },
    CREATE_PROFILE: { cmd: "create_profile" },
} as const;
