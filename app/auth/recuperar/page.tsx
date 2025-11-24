'use client';

import { FormEvent, useState } from 'react';

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email) {
      setError('Ingresa tu correo electrónico.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Ingresa un correo válido.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo enviar el correo.');
        return;
      }

      setSuccess(
        data.message ||
          'Si el correo existe, se ha enviado un enlace para restablecer la contraseña.'
      );
      setEmail('');
    } catch (err: any) {
      setError('Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
        <h1 className="text-2xl font-semibold text-blue-800 mb-2">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Ingresa el correo con el que te registraste y te enviaremos un enlace
          para restablecer tu contraseña.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {loading ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}
              </button>

          <p className="mt-3 text-xs text-center text-gray-600">
            ¿Recordaste tu contraseña?{' '}
            <a
              href="/login"
              className="font-medium text-blue-700 hover:underline"
            >
              Volver al inicio de sesión
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
