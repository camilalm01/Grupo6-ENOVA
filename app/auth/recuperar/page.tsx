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
      setError('Necesitamos tu correo para ayudarte 💜');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Hmm, ese correo no parece válido. ¿Puedes verificarlo?');
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
        setError(data.error || '¡Ups! No pudimos enviar el correo. ¿Lo intentamos de nuevo?');
        return;
      }

      setSuccess(
        data.message ||
          '¡Listo! 📧 Revisa tu correo, te enviamos un enlace para restablecer tu contraseña.'
      );
      setEmail('');
    } catch (err: any) {
      setError('¡Vaya! Ocurrió un error inesperado. ¿Volvemos a intentarlo?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-radial px-4">
      {/* Decoración de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-100 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-100 rounded-full blur-3xl opacity-60"></div>
      </div>

      <div className="relative bg-white p-8 md:p-10 rounded-4xl shadow-xl w-full max-w-md border border-gray-100 animate-fadeInScale">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-400 text-white text-2xl font-bold mb-4 shadow-lg">
            🔑
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            ¿Olvidaste tu contraseña?
          </h1>
          <p className="text-gray-600">
            No te preocupes, te ayudamos a recuperarla 💜
          </p>
        </div>

        {/* Alertas */}
        {error && (
          <div className="alert alert-error mb-6 animate-fadeIn">
            <span className="text-xl">😔</span>
            <p className="text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="alert alert-success mb-6 animate-fadeIn">
            <span className="text-xl">📧</span>
            <p className="text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Tu correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary py-3.5 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Enviando enlace...
              </span>
            ) : (
              '📧 Enviar enlace de recuperación'
            )}
          </button>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              ¿Recordaste tu contraseña?{' '}
              <a
                href="/login"
                className="font-semibold text-purple-600 hover:text-purple-700 transition-colors"
              >
                Volver al inicio de sesión
              </a>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
