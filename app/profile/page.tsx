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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error cargando perfil:', error);
      } else if (data) {
        setFullName(data.full_name || '');
        setAvatarUrl(data.avatar_url || '');
      }

      setLoading(false);
    };

    loadProfile();
  }, [user]);

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
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error actualizando perfil:', error);
      setMessage('❌ Ocurrió un error al guardar los cambios.');
    } else {
      setMessage('✅ Perfil actualizado correctamente.');
    }

    setSaving(false);
  };

  if (loadingUser || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cargando perfil…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4 flex justify-center">
      <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-lg">

        <h1 className="text-xl font-semibold text-gray-800 text-center mb-4">
          Mi Perfil
        </h1>

        {message && (
          <p className="mb-4 text-center text-sm p-2 rounded-lg 
            ${message.startsWith('❌') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}"
          >
            {message}
          </p>
        )}

        {/* Foto de Perfil */}
        <div className="flex flex-col items-center mb-6">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-24 h-24 rounded-full object-cover border"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-purple-300 text-white flex items-center justify-center text-3xl font-semibold">
              {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
            </div>
          )}

          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="URL de tu foto"
            className="mt-3 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Nombre */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre completo
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Botón Guardar */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </main>
  );
}
