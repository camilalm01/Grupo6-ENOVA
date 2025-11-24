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
      return 'Todos los campos son obligatorios.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      return 'Ingresa un correo electrónico válido.';
    }

    if (form.password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres.';
    }

    if (form.password !== form.confirmPassword) {
      return 'Las contraseñas no coinciden.';
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
        setError(data.error || 'Ocurrió un error al registrar la cuenta.');
        return;
      }

      setSuccess(
        data.message ||
          'Registro exitoso. Revisa tu correo para confirmar la cuenta.'
      );
      setForm({ name: '', email: '', password: '', confirmPassword: '' });
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
          Crear cuenta
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Regístrate para acceder al chat seguro de apoyo.
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
              Nombre completo
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Ej: Ana López"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => handleChange('password', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => handleChange('confirmPassword', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Vuelve a escribir tu contraseña"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {loading ? 'Creando cuenta…' : 'Registrarme'}
          </button>

          <p className="mt-3 text-xs text-center text-gray-600">
            ¿Ya tienes cuenta?{' '}
            <a
              href="/login"
              className="font-medium text-blue-700 hover:underline"
            >
              Inicia sesión aquí
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
