/**
 * ENOVA - Enhanced Socket.io Client
 *
 * Real-time WebSocket connection with:
 * - JWT authentication in handshake
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Optimistic UI support
 * - Message queue for offline resilience
 */

import { io, Socket } from "socket.io-client";
import { getAccessToken, refreshToken } from "../api/http-client";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  roomId: string;
  timestamp: string;
  clientMessageId?: string;
  status?: "pending" | "sent" | "delivered" | "error";
}

export interface TypingEvent {
  userId: string;
  username: string;
  roomId: string;
  isTyping: boolean;
}

export interface UserPresenceEvent {
  userId: string;
  username: string;
  roomId: string;
  action: "joined" | "left";
  timestamp: string;
}

export interface RoomInfo {
  roomId: string;
  name: string;
  memberCount: number;
  members: { userId: string; username: string }[];
}

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface SocketEventHandlers {
  onStatusChange?: (status: ConnectionStatus) => void;
  onMessage?: (message: ChatMessage) => void;
  onMessageConfirmed?: (
    clientMessageId: string,
    serverMessage: ChatMessage,
  ) => void;
  onMessageError?: (clientMessageId: string, error: string) => void;
  onHistory?: (messages: ChatMessage[]) => void;
  onTyping?: (event: TypingEvent) => void;
  onPresence?: (event: UserPresenceEvent) => void;
  onRoomInfo?: (info: RoomInfo) => void;
  onError?: (error: { code: string; message: string }) => void;
}

interface QueuedMessage {
  roomId: string;
  message: string;
  userId: string;
  username: string;
  clientMessageId: string;
  timestamp: string;
  retries: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const MESSAGE_QUEUE_MAX_SIZE = 50;
const MESSAGE_RETRY_MAX = 3;

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED SOCKET CLIENT CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class EnhancedSocketClient {
  private socket: Socket | null = null;
  private handlers: SocketEventHandlers = {};
  private currentRoom: string | null = null;
  private status: ConnectionStatus = "disconnected";
  private reconnectAttempts = 0;
  private messageQueue: QueuedMessage[] = [];
  private isProcessingQueue = false;
  private userId: string | null = null;
  private username: string | null = null;

  // ─────────────────────────────────────────────────────────────────────────────
  // CONNECTION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Connect to WebSocket server with JWT authentication
   */
  async connect(handlers: SocketEventHandlers = {}): Promise<boolean> {
    this.handlers = handlers;
    this.setStatus("connecting");

    const token = await getAccessToken();
    if (!token) {
      this.setStatus("error");
      handlers.onError?.({
        code: "NO_AUTH",
        message: "No hay sesión activa para conectar al chat",
      });
      return false;
    }

    return new Promise((resolve) => {
      this.socket = io(WS_URL, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: RECONNECT_BASE_DELAY,
        reconnectionDelayMax: RECONNECT_MAX_DELAY,
        timeout: 10000,
      });

      this.setupEventListeners();

      // Connection timeout
      const timeout = setTimeout(() => {
        if (this.status === "connecting") {
          this.setStatus("error");
          handlers.onError?.({
            code: "TIMEOUT",
            message: "No se pudo conectar al servidor de chat",
          });
          resolve(false);
        }
      }, 15000);

      this.socket.on("connect", () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        console.log("🟢 WebSocket conectado:", this.socket?.id);

        // Process queued messages
        this.processMessageQueue();

        // Rejoin room if was in one
        if (this.currentRoom) {
          this.socket?.emit("join_room", { roomId: this.currentRoom });
        }

        resolve(true);
      });

      this.socket.on("connect_error", async (error) => {
        console.error("WebSocket connection error:", error.message);

        // Try to refresh token on auth error
        if (error.message.includes("AUTH") || error.message.includes("401")) {
          const refreshed = await refreshToken();
          if (refreshed) {
            const newToken = await getAccessToken();
            if (newToken && this.socket) {
              this.socket.auth = { token: newToken };
              // Socket.io will auto-reconnect
            }
          }
        }

        this.reconnectAttempts++;
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          this.setStatus("error");
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });
  }

  /**
   * Setup all socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on("disconnect", (reason) => {
      console.log("🔴 WebSocket desconectado:", reason);

      if (reason === "io server disconnect") {
        // Server initiated disconnect - manual reconnect needed
        this.setStatus("disconnected");
      } else {
        // Client-side disconnect - will auto-reconnect
        this.setStatus("reconnecting");
      }

      this.handlers.onStatusChange?.(this.status);
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log(
        "🟢 WebSocket reconectado después de",
        attemptNumber,
        "intentos",
      );
      this.setStatus("connected");
      this.reconnectAttempts = 0;

      // Rejoin room after reconnect
      if (this.currentRoom) {
        this.socket?.emit("join_room", { roomId: this.currentRoom });
      }

      // Process queued messages
      this.processMessageQueue();
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("🔄 Intento de reconexión #", attemptNumber);
      this.setStatus("reconnecting");
    });

    this.socket.on("reconnect_failed", () => {
      console.error("❌ Reconexión fallida después de máximos intentos");
      this.setStatus("error");
      this.handlers.onError?.({
        code: "RECONNECT_FAILED",
        message: "No se pudo reconectar al chat. Por favor, recarga la página.",
      });
    });

    // Server confirmation
    this.socket.on("connected", (data) => {
      console.log("✅ Autenticado en el servidor:", data);
    });

    // Chat messages
    this.socket.on("receive_message", (message: ChatMessage) => {
      // Check if this is a confirmation for an optimistic message
      if (message.clientMessageId) {
        this.handlers.onMessageConfirmed?.(message.clientMessageId, message);
      }
      this.handlers.onMessage?.(message);
    });

    // Message sent confirmation
    this.socket.on(
      "message_sent",
      (result: {
        success: boolean;
        messageId?: string;
        clientMessageId?: string;
        error?: string;
      }) => {
        if (result.success && result.clientMessageId) {
          // Remove from queue if exists
          this.messageQueue = this.messageQueue.filter(
            (m) => m.clientMessageId !== result.clientMessageId,
          );
        } else if (!result.success && result.clientMessageId) {
          this.handlers.onMessageError?.(
            result.clientMessageId,
            result.error || "Error al enviar mensaje",
          );
        }
      },
    );

    // Chat history
    this.socket.on("chat_history", (messages: ChatMessage[]) => {
      this.handlers.onHistory?.(messages);
    });

    // Typing indicator
    this.socket.on("user_typing", (event: TypingEvent) => {
      this.handlers.onTyping?.(event);
    });

    // User presence
    this.socket.on("user_joined", (event: UserPresenceEvent) => {
      this.handlers.onPresence?.({ ...event, action: "joined" });
    });

    this.socket.on("user_left", (event: UserPresenceEvent) => {
      this.handlers.onPresence?.({ ...event, action: "left" });
    });

    // Room info
    this.socket.on("room_info", (info: RoomInfo) => {
      this.handlers.onRoomInfo?.(info);
    });

    // Errors
    this.socket.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.handlers.onError?.(error);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ROOM MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Join a chat room
   */
  joinRoom(roomId: string, userId: string, username: string): void {
    this.userId = userId;
    this.username = username;

    if (this.currentRoom && this.currentRoom !== roomId) {
      this.leaveRoom();
    }

    this.currentRoom = roomId;

    if (this.socket?.connected) {
      this.socket.emit("join_room", { roomId, userId, username });
    }
  }

  /**
   * Leave current room
   */
  leaveRoom(): void {
    if (!this.currentRoom) return;

    if (this.socket?.connected) {
      this.socket.emit("leave_room", { roomId: this.currentRoom });
    }

    this.currentRoom = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MESSAGING WITH OPTIMISTIC UI
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send a message with optimistic UI support
   * Returns the client message ID for tracking
   */
  sendMessage(message: string): string | null {
    if (!this.currentRoom || !this.userId || !this.username) {
      console.error("Not in a room or user info missing");
      return null;
    }

    const clientMessageId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const messageData: QueuedMessage = {
      roomId: this.currentRoom,
      message: message.trim(),
      userId: this.userId,
      username: this.username,
      clientMessageId,
      timestamp,
      retries: 0,
    };

    if (this.socket?.connected) {
      // Send immediately
      this.socket.emit("send_message", messageData);
    } else {
      // Queue for later
      this.queueMessage(messageData);
    }

    return clientMessageId;
  }

  /**
   * Queue a message for later sending
   */
  private queueMessage(message: QueuedMessage): void {
    if (this.messageQueue.length >= MESSAGE_QUEUE_MAX_SIZE) {
      // Remove oldest message
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);

    console.log(`📥 Mensaje en cola (${this.messageQueue.length} pendientes)`);
  }

  /**
   * Process queued messages after reconnection
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.socket?.connected) return;

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0 && this.socket?.connected) {
      const message = this.messageQueue[0];

      if (message.retries >= MESSAGE_RETRY_MAX) {
        // Give up on this message
        this.messageQueue.shift();
        this.handlers.onMessageError?.(
          message.clientMessageId,
          "No se pudo enviar el mensaje después de varios intentos",
        );
        continue;
      }

      try {
        this.socket.emit("send_message", message);
        this.messageQueue.shift();

        // Small delay between messages
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        message.retries++;
        break; // Stop processing, will retry on next reconnect
      }
    }

    this.isProcessingQueue = false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TYPING INDICATORS
  // ─────────────────────────────────────────────────────────────────────────────

  private typingTimeout: NodeJS.Timeout | null = null;

  /**
   * Send typing indicator
   */
  sendTyping(isTyping: boolean): void {
    if (!this.socket?.connected || !this.currentRoom || !this.username) return;

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    this.socket.emit("typing", {
      roomId: this.currentRoom,
      username: this.username,
      isTyping,
    });

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      this.typingTimeout = setTimeout(() => {
        this.sendTyping(false);
      }, 3000);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS & UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.handlers.onStatusChange?.(status);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    if (this.currentRoom) {
      this.leaveRoom();
    }

    this.socket?.disconnect();
    this.socket = null;
    this.setStatus("disconnected");
    this.messageQueue = [];
  }

  /**
   * Get current connection status
   */
  get connectionStatus(): ConnectionStatus {
    return this.status;
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

  /**
   * Get pending message count
   */
  get pendingMessageCount(): number {
    return this.messageQueue.length;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

const socketClient = new EnhancedSocketClient();

export default socketClient;
export { EnhancedSocketClient };
