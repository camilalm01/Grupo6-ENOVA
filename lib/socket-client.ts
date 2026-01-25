/**
 * Socket.io Client for ENOVA Frontend
 *
 * Connects to the API Gateway WebSocket endpoint.
 * Uses JWT authentication in handshake.
 */

import { io, Socket } from "socket.io-client";
import { getAccessToken, refreshSession } from "./api-client";

// WebSocket URL - use Gateway
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3000";

interface ChatMessage {
    id: string;
    userId: string;
    username: string;
    message: string;
    roomId: string;
    timestamp: string;
    clientMessageId?: string;
}

interface TypingEvent {
    userId: string;
    username: string;
    isTyping: boolean;
}

interface UserEvent {
    userId: string;
    username?: string;
    message?: string;
    timestamp: string;
}

type SocketEventHandlers = {
    onConnect?: () => void;
    onDisconnect?: (reason: string) => void;
    onError?: (error: { code: string; message: string }) => void;
    onMessage?: (message: ChatMessage) => void;
    onHistory?: (messages: ChatMessage[]) => void;
    onTyping?: (event: TypingEvent) => void;
    onUserJoined?: (event: UserEvent) => void;
    onUserLeft?: (event: UserEvent) => void;
    onMessageSent?: (result: { success: boolean; messageId?: string }) => void;
};

class SocketClient {
    private socket: Socket | null = null;
    private handlers: SocketEventHandlers = {};
    private currentRoom: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    /**
     * Connect to WebSocket with JWT authentication
     */
    async connect(handlers: SocketEventHandlers = {}): Promise<boolean> {
        this.handlers = handlers;

        const token = await getAccessToken();
        if (!token) {
            console.error("No access token for WebSocket connection");
            handlers.onError?.({
                code: "NO_TOKEN",
                message: "No access token",
            });
            return false;
        }

        return new Promise((resolve) => {
            this.socket = io(WS_URL, {
                path: "/socket.io",
                transports: ["websocket", "polling"],
                auth: {
                    token, // JWT token for authentication
                },
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
            });

            this.setupEventListeners();

            // Connection timeout
            const timeout = setTimeout(() => {
                if (!this.socket?.connected) {
                    console.error("WebSocket connection timeout");
                    resolve(false);
                }
            }, 10000);

            this.socket.on("connect", () => {
                clearTimeout(timeout);
                this.reconnectAttempts = 0;
                console.log("🟢 WebSocket connected");
                this.handlers.onConnect?.();
                resolve(true);
            });

            this.socket.on("connect_error", async (error) => {
                console.error("WebSocket connection error:", error);

                // Try to refresh token on auth error
                if (
                    error.message.includes("AUTH") && this.reconnectAttempts < 2
                ) {
                    const refreshed = await refreshSession();
                    if (refreshed) {
                        const newToken = await getAccessToken();
                        if (newToken && this.socket) {
                            this.socket.auth = { token: newToken };
                            this.socket.connect();
                        }
                    }
                }

                this.reconnectAttempts++;
            });
        });
    }

    /**
     * Setup all event listeners
     */
    private setupEventListeners() {
        if (!this.socket) return;

        // Connected confirmation from server
        this.socket.on("connected", (data) => {
            console.log("WebSocket authenticated:", data);
        });

        // Disconnect
        this.socket.on("disconnect", (reason) => {
            console.log("🔴 WebSocket disconnected:", reason);
            this.handlers.onDisconnect?.(reason);
        });

        // Error from server
        this.socket.on("error", (error) => {
            console.error("WebSocket error:", error);
            this.handlers.onError?.(error);
        });

        // Chat messages
        this.socket.on("receive_message", (message: ChatMessage) => {
            this.handlers.onMessage?.(message);
        });

        // Chat history
        this.socket.on("chat_history", (messages: ChatMessage[]) => {
            this.handlers.onHistory?.(messages);
        });

        // Typing indicator
        this.socket.on("user_typing", (event: TypingEvent) => {
            this.handlers.onTyping?.(event);
        });

        // User joined
        this.socket.on("user_joined", (event: UserEvent) => {
            this.handlers.onUserJoined?.(event);
        });

        // User left
        this.socket.on("user_left", (event: UserEvent) => {
            this.handlers.onUserLeft?.(event);
        });

        // Message sent confirmation
        this.socket.on("message_sent", (result) => {
            this.handlers.onMessageSent?.(result);
        });
    }

    /**
     * Join a chat room
     */
    joinRoom(roomId: string) {
        if (!this.socket?.connected) {
            console.error("Socket not connected");
            return;
        }

        this.currentRoom = roomId;
        this.socket.emit("join_room", { roomId });
    }

    /**
     * Leave current room
     */
    leaveRoom() {
        if (!this.socket?.connected || !this.currentRoom) return;

        this.socket.emit("leave_room", { roomId: this.currentRoom });
        this.currentRoom = null;
    }

    /**
     * Send a message
     */
    sendMessage(
        message: string,
        userId: string,
        username: string,
        clientMessageId?: string,
    ) {
        if (!this.socket?.connected || !this.currentRoom) {
            console.error("Socket not connected or not in a room");
            return;
        }

        this.socket.emit("send_message", {
            roomId: this.currentRoom,
            message,
            userId,
            username,
            clientMessageId,
        });
    }

    /**
     * Send typing indicator
     */
    sendTyping(username: string, isTyping: boolean) {
        if (!this.socket?.connected || !this.currentRoom) return;

        this.socket.emit("typing", {
            roomId: this.currentRoom,
            username,
            isTyping,
        });
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        if (this.currentRoom) {
            this.leaveRoom();
        }
        this.socket?.disconnect();
        this.socket = null;
    }

    /**
     * Check if connected
     */
    get isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    /**
     * Get current room
     */
    get room(): string | null {
        return this.currentRoom;
    }
}

// Singleton instance
const socketClient = new SocketClient();

export default socketClient;
export { type ChatMessage, SocketClient, type TypingEvent, type UserEvent };
