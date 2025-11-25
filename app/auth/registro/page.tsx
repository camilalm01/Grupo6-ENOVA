'use client';

import { FormEvent, useState } from 'react';

export default function RegistroPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      return 'Todos los campos son necesarios para crear tu cuenta 💜';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      return 'Hmm, ese correo no parece válido. ¿Puedes verificarlo?';
    }

    if (form.password.length < 8) {
      return 'Tu contraseña necesita al menos 8 caracteres para ser segura 🔐';
    }

    if (form.password !== form.confirmPassword) {
      return 'Las contraseñas no coinciden. ¡Intentemos de nuevo!';
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '¡Ups! Algo no salió bien. ¿Lo intentamos de nuevo?');
        return;
      }

      setSuccess(
        data.message ||
          '¡Bienvenida! 🎉 Revisa tu correo para confirmar tu cuenta.'
      );
      setForm({ name: '', email: '', password: '', confirmPassword: '' });
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
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--color-primary-soft)] rounded-full blur-3xl opacity-60"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[var(--color-secondary-soft)] rounded-full blur-3xl opacity-60"></div>
      </div>

      <div className="relative bg-white p-8 md:p-10 rounded-[2rem] shadow-xl w-full max-w-md border border-[var(--color-border-soft)] animate-fadeInScale">
        {/* Logo y título */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-white text-2xl font-bold mb-4 shadow-lg">
            ✨
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Únete a nuestra comunidad 🌸
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Crea tu cuenta y conecta con otras mujeres
          </p>
        </div>

        {/* Alertas */}
        {error && (
          <div className="alert alert-error mb-5 animate-fadeIn">
            <span className="text-xl">😔</span>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="alert alert-success mb-5 animate-fadeIn">
            <span className="text-xl">🎉</span>
            <p className="text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              ¿Cómo te llamas?
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              className="input"
              placeholder="Ej: Ana López"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Tu correo electrónico
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              className="input"
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Crea una contraseña segura
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => handleChange('password', e.target.value)}
              className="input"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Confirma tu contraseña
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => handleChange('confirmPassword', e.target.value)}
              className="input"
              placeholder="Escríbela de nuevo"
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
                Creando tu cuenta...
              </span>
            ) : (
              '✨ Crear mi cuenta'
            )}
          </button>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border-soft)] text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              ¿Ya tienes cuenta?{' '}
              <a
                href="/login"
                className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
              >
                Inicia sesión aquí
              </a>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
