"use client";

/**
 * ENOVA - Refactored ChatRoom Component
 *
 * Uses the new architecture:
 * - useChat hook for state management
 * - Optimistic UI for instant feedback
 * - TanStack Query for caching
 * - Error boundaries for resilience
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useChat, type LocalMessage } from "@/lib/hooks/use-chat";
import { ConnectionStatus, InlineError } from "@/lib/components/error-boundary";
import { ChatSkeleton } from "@/lib/components/skeletons";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatRoomProps {
  roomId: string;
  userId: string;
  username: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface MessageBubbleProps {
  message: LocalMessage;
  isOwn: boolean;
  onRetry?: () => void;
}

function MessageBubble({ message, isOwn, onRetry }: MessageBubbleProps) {
  const isPending = message.status === "pending";
  const hasError = message.status === "error";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
      <div
        className={`flex items-end gap-2 max-w-[75%] ${isOwn ? "flex-row-reverse" : ""}`}
      >
        {/* Avatar for others */}
        {!isOwn && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {message.username.charAt(0).toUpperCase()}
          </div>
        )}

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {/* Username for others */}
          {!isOwn && (
            <span className="text-xs text-purple-600 font-medium mb-1 ml-1">
              {message.username}
            </span>
          )}

          {/* Message bubble */}
          <div
            className={`
              px-4 py-2.5 rounded-2xl break-words
              ${
                isOwn
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-md"
                  : "bg-white text-gray-800 border border-purple-100 rounded-bl-md shadow-sm"
              }
              ${isPending ? "opacity-70" : ""}
              ${hasError ? "border-2 border-red-300 bg-red-50" : ""}
            `}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.message}
            </p>
          </div>

          {/* Status and timestamp */}
          <div className="flex items-center gap-2 mt-1 px-1">
            <span className="text-[10px] text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            {/* Status indicators */}
            {isOwn && (
              <>
                {isPending && (
                  <span className="text-[10px] text-purple-400 animate-pulse">
                    Enviando...
                  </span>
                )}
                {message.status === "delivered" && (
                  <span className="text-[10px] text-green-500">✓✓</span>
                )}
                {hasError && (
                  <button
                    onClick={onRetry}
                    className="text-[10px] text-red-500 hover:text-red-700 underline"
                  >
                    Error - Reintentar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPING INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null;

  const text =
    users.length === 1
      ? `${users[0]} está escribiendo...`
      : users.length === 2
        ? `${users[0]} y ${users[1]} están escribiendo...`
        : `${users[0]} y ${users.length - 1} más están escribiendo...`;

  return (
    <div className="flex items-center gap-2 text-sm text-purple-600 px-4 py-2">
      <div className="flex gap-1">
        <span
          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span>{text}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CHAT ROOM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ChatRoom({ roomId, userId, username }: ChatRoomProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isConnected,
    isConnecting,
    connectionStatus,
    connect,
    messages,
    sendMessage,
    retryMessage,
    typingUsers,
    setTyping,
    isLoading,
    error,
    clearError,
  } = useChat({
    roomId,
    userId,
    username,
    autoConnect: true,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle typing indicator
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Send typing indicator
      if (e.target.value.length > 0) {
        setTyping(true);

        // Stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
        }, 2000);
      } else {
        setTyping(false);
      }
    },
    [setTyping],
  );

  // Handle message send
  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!inputValue.trim() || !isConnected) return;

      sendMessage(inputValue);
      setInputValue("");
      setTyping(false);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Focus input after send
      inputRef.current?.focus();
    },
    [inputValue, isConnected, sendMessage, setTyping],
  );

  // Show loading skeleton
  if (isLoading && messages.length === 0) {
    return <ChatSkeleton />;
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-purple-50/30 to-pink-50/30">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm border-b border-purple-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
            💬
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Sala de Chat</h2>
            <ConnectionStatus
              status={
                connectionStatus as
                  | "connected"
                  | "connecting"
                  | "reconnecting"
                  | "disconnected"
                  | "error"
              }
              className="text-xs"
            />
          </div>
        </div>

        {/* Online users count */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Conectada</span>
        </div>
      </header>

      {/* Error display */}
      {error && (
        <div className="px-4 pt-4">
          <InlineError
            message={error}
            onDismiss={clearError}
            onRetry={connect}
          />
        </div>
      )}

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <span className="text-4xl mb-4">👋</span>
            <p className="font-medium">¡Bienvenida al chat!</p>
            <p className="text-sm">Sé la primera en enviar un mensaje</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.clientMessageId || msg.id}
              message={msg}
              isOwn={msg.userId === userId}
              onRetry={
                msg.clientMessageId
                  ? () => retryMessage(msg.clientMessageId!)
                  : undefined
              }
            />
          ))
        )}

        {/* Typing indicator */}
        <TypingIndicator users={typingUsers} />

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </main>

      {/* Input area */}
      <footer className="p-4 bg-white/80 backdrop-blur-sm border-t border-purple-100">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={
              isConnected ? "Escribe tu mensaje..." : "Conectando..."
            }
            disabled={!isConnected}
            className="flex-1 px-4 py-3 bg-purple-50 border border-purple-100 rounded-full text-sm placeholder:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            autoComplete="off"
          />

          <button
            type="submit"
            disabled={!isConnected || !inputValue.trim()}
            className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
            aria-label="Enviar mensaje"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </form>

        {/* Character count hint */}
        {inputValue.length > 400 && (
          <p className="text-xs text-purple-400 mt-2 ml-4">
            {500 - inputValue.length} caracteres restantes
          </p>
        )}
      </footer>
    </div>
  );
}
