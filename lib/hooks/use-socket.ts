"use client";

/**
 * ENOVA - Socket Hook
 *
 * React hook for WebSocket connection management
 * Provides connection status, handlers, and cleanup
 */

import { useEffect, useState, useCallback, useRef } from "react";
import socketClient, {
  type ConnectionStatus,
  type ChatMessage,
  type TypingEvent,
  type UserPresenceEvent,
  type RoomInfo,
} from "../socket/enhanced-socket-client";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseSocketOptions {
  autoConnect?: boolean;
  onMessage?: (message: ChatMessage) => void;
  onHistory?: (messages: ChatMessage[]) => void;
  onTyping?: (event: TypingEvent) => void;
  onPresence?: (event: UserPresenceEvent) => void;
  onRoomInfo?: (info: RoomInfo) => void;
  onError?: (error: { code: string; message: string }) => void;
}

export interface UseSocketReturn {
  status: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  pendingMessages: number;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  joinRoom: (roomId: string, userId: string, username: string) => void;
  leaveRoom: () => void;
  sendMessage: (message: string) => string | null;
  sendTyping: (isTyping: boolean) => void;
  currentRoom: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    autoConnect = false,
    onMessage,
    onHistory,
    onTyping,
    onPresence,
    onRoomInfo,
    onError,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>(
    socketClient.isConnected ? "connected" : "disconnected",
  );
  const [pendingMessages, setPendingMessages] = useState(0);

  // Use refs to avoid stale closures in socket callbacks
  const handlersRef = useRef({
    onMessage,
    onHistory,
    onTyping,
    onPresence,
    onRoomInfo,
    onError,
  });

  useEffect(() => {
    handlersRef.current = {
      onMessage,
      onHistory,
      onTyping,
      onPresence,
      onRoomInfo,
      onError,
    };
  }, [onMessage, onHistory, onTyping, onPresence, onRoomInfo, onError]);

  // Connect function
  const connect = useCallback(async (): Promise<boolean> => {
    return socketClient.connect({
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        setPendingMessages(socketClient.pendingMessageCount);
      },
      onMessage: (msg) => handlersRef.current.onMessage?.(msg),
      onMessageConfirmed: (clientId, serverMsg) => {
        // Could be used to update optimistic messages
        handlersRef.current.onMessage?.(serverMsg);
      },
      onMessageError: (clientId, error) => {
        handlersRef.current.onError?.({
          code: "MESSAGE_FAILED",
          message: error,
        });
      },
      onHistory: (msgs) => handlersRef.current.onHistory?.(msgs),
      onTyping: (evt) => handlersRef.current.onTyping?.(evt),
      onPresence: (evt) => handlersRef.current.onPresence?.(evt),
      onRoomInfo: (info) => handlersRef.current.onRoomInfo?.(info),
      onError: (err) => handlersRef.current.onError?.(err),
    });
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    socketClient.disconnect();
    setStatus("disconnected");
  }, []);

  // Room management
  const joinRoom = useCallback(
    (roomId: string, userId: string, username: string) => {
      socketClient.joinRoom(roomId, userId, username);
    },
    [],
  );

  const leaveRoom = useCallback(() => {
    socketClient.leaveRoom();
  }, []);

  // Messaging
  const sendMessage = useCallback((message: string): string | null => {
    const clientId = socketClient.sendMessage(message);
    setPendingMessages(socketClient.pendingMessageCount);
    return clientId;
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    socketClient.sendTyping(isTyping);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && status === "disconnected") {
      connect();
    }

    // Cleanup on unmount
    return () => {
      // Don't disconnect on unmount - keep connection alive across navigations
      // disconnect();
    };
  }, [autoConnect, connect, status]);

  // Sync status with socket client
  useEffect(() => {
    const interval = setInterval(() => {
      const currentStatus = socketClient.isConnected
        ? "connected"
        : status === "reconnecting"
          ? "reconnecting"
          : "disconnected";
      if (currentStatus !== status) {
        setStatus(currentStatus);
      }
      setPendingMessages(socketClient.pendingMessageCount);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  return {
    status,
    isConnected: status === "connected",
    isConnecting: status === "connecting" || status === "reconnecting",
    pendingMessages,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    currentRoom: socketClient.room,
  };
}

export default useSocket;
