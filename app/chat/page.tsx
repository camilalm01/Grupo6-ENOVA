'use client';

/**
 * PÁGINA DE CHAT INTEGRADA
 *
 * Esta página integra el componente ChatRoom con el sistema de autenticación
 * de Supabase y mantiene la consistencia visual con el resto de la aplicación.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/services/supabaseClient';
import { useSupabaseUser } from '@/lib/services/useSupabaseUser';
import ChatRoom from './ChatRoom';

export default function ChatPage() {
  const router = useRouter();
  const { user, loadingUser } = useSupabaseUser();
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  // Redirigir si no está logueada
  useEffect(() => {
    if (!loadingUser && !user) {
      router.push('/login');
    }
  }, [loadingUser, user, router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Error al cerrar sesión', err);
    }
  };

  // Mostrar loading mientras se verifica la sesión
  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-radial">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  // No mostrar nada si no hay usuario (se redirigirá)
  if (!user) return null;

  // Obtener datos del usuario para el chat
  const userId = user.id;
  const username =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    (user.email?.split('@')[0] as string) ||
    'Usuaria';

  const selfProfileName = username;
  const roomId = 'general'; // Sala por defecto

  return (
    <div className="min-h-screen bg-gradient-radial pb-16 md:pb-0">
      {/* NAVBAR */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
              🌸
            </div>
            <span className="font-semibold text-lg text-gray-800">
              ENOVA
            </span>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-6 text-sm text-gray-600">
              <button
                onClick={() => router.push('/dashboard')}
                className="hover:text-purple-600 transition-colors"
              >
                Inicio
              </button>
              <button className="font-medium text-purple-600">Chat</button>
            </nav>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAvatarMenuOpen((prev) => !prev)}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-sm font-semibold cursor-pointer hover:shadow-lg transition-all"
              >
                {selfProfileName.charAt(0).toUpperCase()}
              </button>

              {isAvatarMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-2xl shadow-xl text-sm z-20 overflow-hidden animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      router.push('/profile');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors"
                  >
                    👤 Mi perfil
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsAvatarMenuOpen(false);
                      await handleLogout();
                    }}
                    className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    👋 Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Título de la sección */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            💬 Chat de Apoyo
          </h1>
          <p className="text-gray-600 text-sm">
            Espacio seguro para conectar con otras mujeres de la comunidad
          </p>
        </div>

        {/* Componente de Chat */}
        <ChatRoom roomId={roomId} userId={userId} username={username} />

        {/* Footer informativo */}
        <div className="mt-6 p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💜</span>
            <div>
              <h3 className="font-semibold text-purple-800 mb-2">
                Normas del Chat
              </h3>
              <ul className="text-sm text-purple-700 space-y-1.5">
                <li>• Este es un espacio de apoyo mutuo y respeto</li>
                <li>• No compartas información personal sensible</li>
                <li>• Si necesitas ayuda urgente, contacta a los recursos de emergencia</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 px-4 py-2 z-10">
        <div className="flex justify-around">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center text-gray-600 hover:text-purple-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
            <span className="text-xs mt-1">Inicio</span>
          </button>
          <button className="flex flex-col items-center text-purple-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
              />
            </svg>
            <span className="text-xs mt-1">Chat</span>
          </button>
          <button
            onClick={() => router.push('/profile')}
            className="flex flex-col items-center text-gray-600 hover:text-purple-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
            <span className="text-xs mt-1">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
