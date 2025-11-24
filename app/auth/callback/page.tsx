'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    // El hash viene así: #access_token=...&type=signup&...
    const hash = window.location.hash.substring(1); // quitamos el '#'
    const params = new URLSearchParams(hash);

    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(errorDescription || 'El enlace es inválido o ha expirado.');
      return;
    }

    // Si no viene error, asumimos que la verificación fue OK
    setStatus('success');
    setMessage('Correo verificado con éxito. Ya puedes iniciar sesión.');

    // Opcional: redirigir al login después de unos segundos
    const timeout = setTimeout(() => {
      router.push('/login');
    }, 2500);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 text-center">
        {status === 'checking' && (
          <>
            <h1 className="text-xl font-semibold text-blue-800 mb-2">
              Verificando enlace…
            </h1>
            <p className="text-sm text-gray-600">
              Por favor, espera un momento.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-xl font-semibold text-green-700 mb-2">
              ¡Cuenta verificada!
            </h1>
            <p className="text-sm text-gray-600 mb-2">
              {message}
            </p>
            <p className="text-xs text-gray-500">
              Te redirigiremos al login en unos segundos…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-xl font-semibold text-red-700 mb-2">
              Enlace no válido
            </h1>
            <p className="text-sm text-gray-600 mb-4">
              {message}
            </p>
            <a
              href="/auth/recuperar"
              className="text-sm text-blue-700 font-medium hover:underline"
            >
              Solicitar un nuevo enlace
            </a>
          </>
        )}
      </div>
    </main>
  );
}
