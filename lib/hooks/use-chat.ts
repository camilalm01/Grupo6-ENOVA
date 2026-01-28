"use client";

/**
 * ENOVA - Chat Hook with Optimistic UI
 *
 * Combines WebSocket connection with local state management
 * for a smooth real-time chat experience.
 *
 * Features:
 * - Optimistic message sending
 * - Message status tracking (pending/sent/error)
 * - Typing indicators
 * - Auto-reconnection handling
 * - Message caching with TanStack Query
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./use-socket";
import { queryKeys } from "../providers/query-provider";
import type {
  ChatMessage,
  TypingEvent,
  UserPresenceEvent,
} from "../socket/enhanced-socket-client";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LocalMessage extends ChatMessage {
  status: "pending" | "sent" | "delivered" | "error";
  errorMessage?: string;
}

export interface UseChatOptions {
  roomId: string;
  userId: string;
  username: string;
  autoConnect?: boolean;
}

export interface UseChatReturn {
  // Connection
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus: string;
  connect: () => Promise<boolean>;
  disconnect: () => void;

  // Messages
  messages: LocalMessage[];
  sendMessage: (content: string) => void;
  retryMessage: (clientMessageId: string) => void;

  // Typing
  typingUsers: string[];
  setTyping: (isTyping: boolean) => void;

  // Presence
  onlineUsers: string[];

  // State
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useChat(options: UseChatOptions): UseChatReturn {
  const { roomId, userId, username, autoConnect = true } = options;

  const queryClient = useQueryClient();

  // Local state
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track pending messages for retry
  const [pendingMessages, setPendingMessages] = useState<
    Map<string, LocalMessage>
  >(new Map());

  // ─────────────────────────────────────────────────────────────────────────────
  // MESSAGE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      // Check if this confirms a pending message
      if (message.clientMessageId) {
        const existingIndex = prev.findIndex(
          (m) => m.clientMessageId === message.clientMessageId,
        );
        if (existingIndex !== -1) {
          // Update the pending message to confirmed
          const updated = [...prev];
          updated[existingIndex] = {
            ...message,
            status: "delivered" as const,
          };

          // Remove from pending
          setPendingMessages((p) => {
            const newMap = new Map(p);
            newMap.delete(message.clientMessageId!);
            return newMap;
          });

          return updated;
        }
      }

      // Check if message already exists (duplicate prevention)
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }

      // Add new message
      return [...prev, { ...message, status: "delivered" as const }];
    });
  }, []);

  const handleHistory = useCallback(
    (history: ChatMessage[]) => {
      setMessages(
        history.map((msg) => ({ ...msg, status: "delivered" as const })),
      );
      setIsLoading(false);

      // Cache in React Query
      queryClient.setQueryData(queryKeys.chat.messages(roomId), history);
    },
    [roomId, queryClient],
  );

  const handleTyping = useCallback(
    (event: TypingEvent) => {
      if (event.userId === userId) return; // Ignore own typing

      setTypingUsers((prev) => {
        if (event.isTyping) {
          return prev.includes(event.username)
            ? prev
            : [...prev, event.username];
        } else {
          return prev.filter((u) => u !== event.username);
        }
      });

      // Auto-clear typing after 5 seconds (fallback)
      if (event.isTyping) {
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== event.username));
        }, 5000);
      }
    },
    [userId],
  );

  const handlePresence = useCallback((event: UserPresenceEvent) => {
    setOnlineUsers((prev) => {
      if (event.action === "joined") {
        return prev.includes(event.username) ? prev : [...prev, event.username];
      } else {
        return prev.filter((u) => u !== event.username);
      }
    });
  }, []);

  const handleError = useCallback((err: { code: string; message: string }) => {
    console.error("Chat error:", err);

    // Handle message-specific errors
    if (err.code === "MESSAGE_FAILED") {
      // Error is already handled in the message status
      return;
    }

    setError(err.message);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // SOCKET CONNECTION
  // ─────────────────────────────────────────────────────────────────────────────

  const {
    status,
    isConnected,
    isConnecting,
    connect: socketConnect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage: socketSendMessage,
    sendTyping,
  } = useSocket({
    autoConnect,
    onMessage: handleMessage,
    onHistory: handleHistory,
    onTyping: handleTyping,
    onPresence: handlePresence,
    onError: handleError,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONNECTION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  const connect = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    const connected = await socketConnect();

    if (connected) {
      joinRoom(roomId, userId, username);
    } else {
      setIsLoading(false);
      setError("No se pudo conectar al chat");
    }

    return connected;
  }, [socketConnect, joinRoom, roomId, userId, username]);

  // Auto-join room when connected
  useEffect(() => {
    if (isConnected && roomId) {
      joinRoom(roomId, userId, username);
    }

    return () => {
      if (isConnected) {
        leaveRoom();
      }
    };
  }, [isConnected, roomId, userId, username, joinRoom, leaveRoom]);

  // ─────────────────────────────────────────────────────────────────────────────
  // OPTIMISTIC MESSAGE SENDING
  // ─────────────────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;

      const clientMessageId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      // Create optimistic message
      const optimisticMessage: LocalMessage = {
        id: clientMessageId, // Temporary ID
        clientMessageId,
        userId,
        username,
        message: content.trim(),
        roomId,
        timestamp,
        status: "pending",
      };

      // Add to messages immediately (optimistic update)
      setMessages((prev) => [...prev, optimisticMessage]);

      // Track pending message
      setPendingMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(clientMessageId, optimisticMessage);
        return newMap;
      });

      // Send via socket
      const sentId = socketSendMessage(content);

      if (!sentId) {
        // Failed to send - mark as error
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId
              ? {
                  ...m,
                  status: "error" as const,
                  errorMessage: "No se pudo enviar el mensaje",
                }
              : m,
          ),
        );
      }

      // Set timeout to mark as error if no confirmation
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId && m.status === "pending"
              ? {
                  ...m,
                  status: "error" as const,
                  errorMessage: "Tiempo de espera agotado",
                }
              : m,
          ),
        );
      }, 30000); // 30 second timeout
    },
    [userId, username, roomId, socketSendMessage],
  );

  // Retry failed message
  const retryMessage = useCallback(
    (clientMessageId: string) => {
      const pendingMessage = pendingMessages.get(clientMessageId);
      if (!pendingMessage) return;

      // Update status to pending
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, status: "pending" as const, errorMessage: undefined }
            : m,
        ),
      );

      // Try to send again
      socketSendMessage(pendingMessage.message);
    },
    [pendingMessages, socketSendMessage],
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TYPING INDICATOR
  // ─────────────────────────────────────────────────────────────────────────────

  const setTyping = useCallback(
    (isTyping: boolean) => {
      sendTyping(isTyping);
    },
    [sendTyping],
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Sorted messages
  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [messages]);

  return {
    // Connection
    isConnected,
    isConnecting,
    connectionStatus: status,
    connect,
    disconnect,

    // Messages
    messages: sortedMessages,
    sendMessage,
    retryMessage,

    // Typing
    typingUsers,
    setTyping,

    // Presence
    onlineUsers,

    // State
    isLoading,
    error,
    clearError,
  };
}

export default useChat;
