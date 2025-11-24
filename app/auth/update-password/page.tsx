'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/services/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError(
          'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.'
        );
      } else {
        setSessionReady(true);
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!password || !confirmPassword) {
      setError('Completa ambos campos de contraseña.');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setSuccess(
        'Contraseña actualizada con éxito. Ahora puedes iniciar sesión.'
      );
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => router.push('/login'), 2500);
    } catch (err: any) {
      setError(
        err?.message || 'Ocurrió un error al actualizar la contraseña.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
        <h1 className="text-2xl font-semibold text-blue-800 mb-2">
          Restablecer contraseña
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Crea una nueva contraseña para tu cuenta.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            {success}
          </div>
        )}

        {!sessionReady && !error && (
          <p className="text-sm text-gray-500 mb-4">
            Verificando enlace de recuperación…
          </p>
        )}

        {sessionReady && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar nueva contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Repite la contraseña"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {loading ? 'Guardando…' : 'Actualizar contraseña'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
