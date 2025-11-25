'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/services/supabaseClient';

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validación básica de los campos
    if (!email || !password) {
      setError('Nos encantaría saber tu email y contraseña 💜');
      setLoading(false);
      return;
    }

    // Hacer el sign-in en el cliente con Supabase para que la sesión se establezca localmente
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError('Hmm, no reconocemos esos datos. ¿Lo intentamos de nuevo?');
        setLoading(false);
        return;
      }

      // Si todo OK, navegar al dashboard (la sesión ya está en el cliente)
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('¡Ups! Algo no salió bien. ¿Volvemos a intentarlo?');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-radial px-4">
      {/* Decoración de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--color-primary-soft)] rounded-full blur-3xl opacity-60"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[var(--color-secondary-soft)] rounded-full blur-3xl opacity-60"></div>
      </div>

      <div className="relative bg-white p-8 md:p-10 rounded-[2rem] shadow-xl w-full max-w-md border border-[var(--color-border-soft)] animate-fadeInScale">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-white text-2xl font-bold mb-4 shadow-lg">
            🌸
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            ¡Hola de nuevo! 💜
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Ingresa a tu espacio seguro
          </p>
        </div>

        {/* Alerta de error */}
        {error && (
          <div className="alert alert-error mb-6 animate-fadeIn">
            <span className="text-xl">😔</span>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2"
            >
              Correo electrónico
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2"
            >
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
              placeholder="Tu contraseña secreta"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary py-3.5 text-base mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Entrando...
              </span>
            ) : (
              '💜 Iniciar sesión'
            )}
          </button>
        </form>

        {/* Footer del formulario */}
        <div className="mt-8 pt-6 border-t border-[var(--color-border-soft)]">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
            <a
              href="/auth/recuperar"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200"
            >
              ¿Olvidaste tu contraseña?
            </a>

            <span className="hidden sm:block w-1 h-1 rounded-full bg-[var(--color-border)]"></span>

            <a
              href="/auth/registro"
              className="btn btn-secondary py-2 px-4 text-sm"
            >
              ✨ Crear cuenta
            </a>
          </div>

          <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
            ¿Primera vez aquí? Te damos la bienvenida a nuestra comunidad 🌸
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;