/**
 * PÁGINA DE CHAT
 * 
 * Esta es una página de ejemplo que muestra cómo usar el componente ChatRoom.
 * En producción, aquí obtendrías el userId y username del sistema de autenticación.
 */

import ChatRoom from "./ChatRoom";

export default function ChatPage() {
  // TODO: Obtener estos datos del sistema de autenticación (Supabase Auth)
  // Ejemplo:
  // const { user } = useAuth();
  // const userId = user?.id;
  // const username = user?.user_metadata?.username;

  const demoUserId = "demo-user-123"; // Reemplazar con ID real
  const demoUsername = "Usuaria Demo"; // Reemplazar con nombre real
  const demoRoomId = "general"; // Reemplazar con lógica de salas

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
            Plataforma de Autonomía Femenina
          </h1>
          <p className="text-gray-600">
            Chat en Tiempo Real - Espacio Seguro de Apoyo
          </p>
        </div>

        <ChatRoom
          roomId={demoRoomId}
          userId={demoUserId}
          username={demoUsername}
        />

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>💜 Este es un espacio seguro y de apoyo mutuo</p>
          <p className="text-xs mt-2">
            Usuario actual: {demoUsername} | Sala: {demoRoomId}
          </p>
        </div>
      </div>
    </div>
  );
}
