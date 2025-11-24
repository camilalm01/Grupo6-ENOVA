// app/api/auth/forgot-password/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/services/supabaseClient';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'El correo es obligatorio.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Correo electrónico inválido.' },
        { status: 400 }
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${
        process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      }/auth/update-password`,
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
          'Si el correo existe, se ha enviado un enlace para restablecer la contraseña.',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error en /api/auth/forgot-password:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
