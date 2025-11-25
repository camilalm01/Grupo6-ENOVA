'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/services/supabaseClient';
import { useSupabaseUser } from '@/lib/services/useSupabaseUser';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, loadingUser } = useSupabaseUser();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  // Redirigir si no está logueada
  useEffect(() => {
    if (!loadingUser && !user) {
      router.push('/login');
    }
  }, [loadingUser, user, router]);

  // Cargar perfil
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, bio')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error cargando perfil:', error);
      } else if (data) {
        setFullName(data.full_name || '');
        setAvatarUrl(data.avatar_url || '');
        setBio(data.bio || '');
      }

      setLoading(false);
    };

    loadProfile();
  }, [user]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Error al cerrar sesión', err);
    }
  };

  // Guardar cambios
  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        avatar_url: avatarUrl,
        bio: bio,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error actualizando perfil:', error);
      setMessage({ type: 'error', text: '¡Ups! No pudimos guardar los cambios. ¿Lo intentamos de nuevo?' });
    } else {
      setMessage({ type: 'success', text: '¡Perfecto! Tu perfil quedó actualizado ✨' });
    }

    setSaving(false);
  };

  const selfProfileName =
    fullName ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email?.split('@')[0] as string) ||
    'Usuaria';

  if (loadingUser || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-radial">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Cargando tu perfil…</p>
        </div>
      </div>
    );
  }

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
              <button
                onClick={() => router.push('/chat')}
                className="hover:text-purple-600 transition-colors"
              >
                Chat
              </button>
              <button className="font-medium text-purple-600">Mi Perfil</button>
            </nav>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAvatarMenuOpen(prev => !prev)}
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
                      router.push('/dashboard');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors"
                  >
                    🏠 Ir al inicio
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

      {/* CONTENIDO */}
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8 border border-gray-100">
          {/* Header del perfil */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">
              Mi Perfil 💜
            </h1>
            <p className="text-gray-500 text-sm">
              Personaliza tu espacio en la comunidad
            </p>
          </div>

          {/* Alertas */}
          {message && (
            <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'} mb-6 animate-fadeIn`}>
              <span className="text-xl">{message.type === 'success' ? '✨' : '😔'}</span>
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          {/* Foto de Perfil */}
          <div className="flex flex-col items-center mb-6">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Tu foto de perfil"
                className="w-28 h-28 rounded-full object-cover border-4 border-purple-100 shadow-md"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-white flex items-center justify-center text-4xl font-bold shadow-md">
                {fullName ? fullName.charAt(0).toUpperCase() : '✨'}
              </div>
            )}

            <div className="mt-4 w-full">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                URL de tu foto
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://ejemplo.com/tu-foto.jpg"
                className="input text-sm"
              />
            </div>
          </div>

          {/* Nombre */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ¿Cómo quieres que te llamemos? 💜
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre"
              className="input"
            />
          </div>

          {/* Bio */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cuéntanos sobre ti (opcional)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Comparte un poco sobre ti, tus intereses o lo que quieras que la comunidad sepa..."
              rows={3}
              className="input resize-none"
            />
          </div>

          {/* Botón Guardar */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full btn btn-primary py-3.5 text-base"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Guardando cambios...
              </span>
            ) : (
              '💜 Guardar cambios'
            )}
          </button>
        </div>
      </main>

      {/* Mobile navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 px-4 py-2 z-10">
        <div className="flex justify-around">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center text-gray-600 hover:text-purple-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="text-xs mt-1">Inicio</span>
          </button>
          <button
            onClick={() => router.push('/chat')}
            className="flex flex-col items-center text-gray-600 hover:text-purple-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
            <span className="text-xs mt-1">Chat</span>
          </button>
          <button className="flex flex-col items-center text-purple-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <span className="text-xs mt-1">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
