"use client";

/**
 * COMPONENTE DE CHAT EN TIEMPO REAL
 * 
 * Componente React para chat con WebSockets (Socket.io)
 * Diseño moderno con tema de empoderamiento femenino (violeta/lila)
 * 
 * Características:
 * - Conexión en tiempo real con Socket.io
 * - Indicador de estado de conexión
 * - Diferenciación de mensajes propios/ajenos
 * - Indicador de "escribiendo..."
 * - Auto-scroll al nuevo mensaje
 * - Responsive y accesible
 */

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

// ═══════════════════════════════════════════════════════
// TIPOS Y INTERFACES
// ═══════════════════════════════════════════════════════
interface Message {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
  socketId?: string;
}

interface ChatRoomProps {
  roomId: string;
  userId: string;
  username: string;
}

// Singleton para evitar múltiples conexiones en desarrollo (React StrictMode)
let socket: Socket | null = null;

export default function ChatRoom({ roomId, userId, username }: ChatRoomProps) {
  // ═══════════════════════════════════════════════════════
  // ESTADO DEL COMPONENTE
  // ═══════════════════════════════════════════════════════
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");

  // Helper para mapear la fecha correctamente
  const mapMessageDate = (data: any): Message => ({
    ...data,
    message: data.message || data.content || "",
    timestamp: data.timestamp || data.created_at || "",
  });
  const [isSending, setIsSending] = useState(false);

  // Referencias
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ═══════════════════════════════════════════════════════
  // CONEXIÓN Y CONFIGURACIÓN DE SOCKET.IO
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    // Inicializar socket solo si no existe
    if (!socket) {
      socket = io({
        path: "/socket.io",
        auth: {
          // token: "tu-jwt-token-aqui" // Agregar si usas autenticación
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });
    }

    // ───────────────────────────────────────────────────
    // LISTENERS DE CONEXIÓN
    // ───────────────────────────────────────────────────
    const handleConnect = () => {
      console.log("🟢 Conectado al servidor WebSocket:", socket?.id);
      setIsConnected(true);

      // Unirse a la sala automáticamente al conectar
      socket?.emit("join_room", { roomId, userId });
    };

    const handleDisconnect = (reason: string) => {
      console.log("🔴 Desconectado del servidor:", reason);
      setIsConnected(false);
    };

    const handleConnectError = (error: Error) => {
      console.error("❌ Error de conexión:", error);
      setIsConnected(false);
    };

    // ───────────────────────────────────────────────────
    // LISTENERS DE MENSAJES
    // ───────────────────────────────────────────────────
    const handleReceiveMessage = (data: any) => {
      console.log("📨 Mensaje recibido:", data);
      setMessages((prev) => [...prev, mapMessageDate(data)]);
    };

    const handleChatHistory = (history: any[]) => {
      console.log("📜 Historial cargado:", history.length, "mensajes");
      setMessages(history.map(mapMessageDate));
    };

    const handleUserJoined = (data: { userId: string; message: string }) => {
      console.log("👋 Usuario se unió:", data);
      // Opcional: Mostrar notificación de entrada
    };

    const handleUserLeft = (data: { userId: string; message: string }) => {
      console.log("👋 Usuario salió:", data);
      // Opcional: Mostrar notificación de salida
    };

    const handleUserTyping = (data: { username: string; isTyping: boolean }) => {
      if (data.isTyping) {
        setIsTyping(true);
        setTypingUser(data.username);
      } else {
        setIsTyping(false);
        setTypingUser("");
      }
    };

    const handleError = (error: { message: string; details?: string }) => {
      console.error("❌ Error del servidor:", error);
      alert(`Error: ${error.message}`);
    };

    // ───────────────────────────────────────────────────
    // REGISTRAR LISTENERS
    // ───────────────────────────────────────────────────
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("chat_history", handleChatHistory);
    socket.on("user_joined", handleUserJoined);
    socket.on("user_left", handleUserLeft);
    socket.on("user_typing", handleUserTyping);
    socket.on("error", handleError);

    // ───────────────────────────────────────────────────
    // CLEANUP: Remover listeners al desmontar
    // ───────────────────────────────────────────────────
    return () => {
      socket?.off("connect", handleConnect);
      socket?.off("disconnect", handleDisconnect);
      socket?.off("connect_error", handleConnectError);
      socket?.off("receive_message", handleReceiveMessage);
      socket?.off("chat_history", handleChatHistory);
      socket?.off("user_joined", handleUserJoined);
      socket?.off("user_left", handleUserLeft);
      socket?.off("user_typing", handleUserTyping);
      socket?.off("error", handleError);
    };
  }, [roomId, userId]);

  // ═══════════════════════════════════════════════════════
  // AUTO-SCROLL AL ÚLTIMO MENSAJE
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ═══════════════════════════════════════════════════════
  // FUNCIÓN: ENVIAR MENSAJE
  // ═══════════════════════════════════════════════════════
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() || !socket || !isConnected) {
      return;
    }

    setIsSending(true);

    const messageData: Omit<Message, 'id'> = {
      userId,
      username,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      socketId: socket.id
    };

    // Emitir evento al servidor
    socket.emit("send_message", { ...messageData, roomId });

    // Limpiar input
    setMessage("");
    setIsSending(false);

    // Detener indicador de escritura
    socket.emit("typing", { roomId, username, isTyping: false });

    // Enfocar input nuevamente
    inputRef.current?.focus();
  };

  // ═══════════════════════════════════════════════════════
  // FUNCIÓN: INDICADOR DE ESCRITURA
  // ═══════════════════════════════════════════════════════
  const handleTyping = () => {
    if (!socket || !isConnected) return;

    // Emitir evento de "está escribiendo"
    socket.emit("typing", { roomId, username, isTyping: true });

    // Cancelar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Detener indicador después de 2 segundos de inactividad
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("typing", { roomId, username, isTyping: false });
    }, 2000);
  };

  // ═══════════════════════════════════════════════════════
  // FUNCIÓN: VERIFICAR SI EL MENSAJE ES PROPIO
  // ═══════════════════════════════════════════════════════
  const isOwnMessage = (msg: Message) => {
    return msg.userId === userId || msg.socketId === socket?.id;
  };

  // ═══════════════════════════════════════════════════════
  // FUNCIÓN: FORMATEAR FECHA
  // ═══════════════════════════════════════════════════════
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // ═══════════════════════════════════════════════════════
  // RENDERIZADO DEL COMPONENTE
  // ═══════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto border-2 border-purple-200 rounded-2xl shadow-2xl bg-gradient-to-br from-white to-purple-50">
      {/* ───────────────────────────────────────────────── */}
      {/* HEADER DEL CHAT */}
      {/* ───────────────────────────────────────────────── */}
      <div className="p-5 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white rounded-t-2xl flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-lg">Chat de Apoyo</h2>
            <p className="text-xs text-purple-100">Sala: {roomId}</p>
          </div>
        </div>

        {/* Indicador de Conexión */}
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
              }`}
          />
          <span className="text-sm font-medium">
            {isConnected ? "En línea" : "Desconectado"}
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────── */}
      {/* ÁREA DE MENSAJES */}
      {/* ───────────────────────────────────────────────── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white/50 backdrop-blur-sm">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-16 h-16 mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
              />
            </svg>
            <p className="text-lg font-medium">No hay mensajes aún</p>
            <p className="text-sm">¡Sé la primera en enviar un mensaje!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const isOwn = isOwnMessage(msg);

              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isOwn ? "items-end" : "items-start"
                    }`}
                >
                  {/* Nombre del usuario (solo mensajes ajenos) */}
                  {!isOwn && (
                    <span className="text-xs text-gray-500 mb-1 ml-2">
                      {msg.username}
                    </span>
                  )}

                  {/* Burbuja del mensaje */}
                  <div
                    className={`max-w-[75%] p-4 rounded-2xl shadow-md ${isOwn
                      ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-br-none"
                      : "bg-white border-2 border-purple-100 text-gray-800 rounded-bl-none"
                      }`}
                  >
                    <p className="text-sm leading-relaxed break-words">
                      {msg.message}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <span
                    className={`text-xs text-gray-400 mt-1 ${isOwn ? "mr-2" : "ml-2"
                      }`}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              );
            })}

            {/* Indicador de "escribiendo..." */}
            {isTyping && (
              <div className="flex items-center gap-2 text-sm text-gray-500 ml-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <span
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
                <span>{typingUser} está escribiendo...</span>
              </div>
            )}

            {/* Referencia para auto-scroll */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ───────────────────────────────────────────────── */}
      {/* FORMULARIO DE ENVÍO */}
      {/* ───────────────────────────────────────────────── */}
      <form
        onSubmit={sendMessage}
        className="p-5 border-t-2 border-purple-100 bg-white rounded-b-2xl flex gap-3"
      >
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            handleTyping();
          }}
          placeholder="Escribe tu mensaje..."
          disabled={!isConnected}
          className="flex-1 border-2 border-purple-200 rounded-full px-5 py-3 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={!isConnected || !message.trim() || isSending}
          className="bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-full p-3 hover:from-purple-700 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
          aria-label="Enviar mensaje"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
