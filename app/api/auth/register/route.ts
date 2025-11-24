// app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/services/supabaseClient';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nombre, correo y contraseña son obligatorios.' },
        { status: 400 }
      );
    }

    // Validación básica extra del lado del servidor
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Correo electrónico inválido.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
        // URL donde llega el correo de verificación
        emailRedirectTo: `${
          process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        }/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message:
          'Registro exitoso. Revisa tu correo para confirmar la cuenta antes de iniciar sesión.',
        user: data.user,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error en /api/auth/register:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
