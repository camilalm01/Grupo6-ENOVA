'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/services/supabaseClient';

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación básica de los campos
    if (!email || !password) {
      setError('Por favor ingrese un email y una contraseña');
      return;
    }

    // Hacer el sign-in en el cliente con Supabase para que la sesión se establezca localmente
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message || 'Error en el inicio de sesión');
        return;
      }

      // Si todo OK, navegar al dashboard (la sesión ya está en el cliente)
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Hubo un error al intentar iniciar sesión');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Iniciar sesión</h2>
          <p className="text-gray-600">Ingresa a tu cuenta</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-semibold text-gray-800 mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white text-gray-800 placeholder-gray-500"
              placeholder="tu@email.com"
            />
          </div>

          <div className="mb-8">
            <label htmlFor="password" className="block text-sm font-semibold text-gray-800 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white text-gray-800 placeholder-gray-500"
              placeholder="Ingresa tu contraseña"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:ring-4 focus:ring-blue-200 transition-all duration-200 shadow-lg"
          >
            Iniciar sesión
          </button>
        </form>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-4">
            <a
              href="/auth/recuperar"
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors duration-200"
              aria-label="Recuperar contraseña"
            >
              ¿Olvidaste tu contraseña?
            </a>

            <span className="hidden sm:inline-block w-px h-4 bg-gray-200" aria-hidden="true" />

            <a
              href="/auth/registro"
              className="inline-block py-2 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
              aria-label="Registrarse"
            >
              Regístrate
            </a>
          </div>

          <p className="mt-2 text-xs text-gray-500">También puedes crear una cuenta nueva si aún no tienes una.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;