// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/services/supabaseClient';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Correo y contraseña son obligatorios.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Mensaje genérico (no filtramos si el usuario existe o no)
      return NextResponse.json(
        { error: 'Credenciales incorrectas o cuenta no verificada.' },
        { status: 401 }
      );
    }

    // Aquí podrías manejar cookies/JWT más adelante si quieres
    return NextResponse.json(
      {
        message: 'Inicio de sesión exitoso.',
        user: data.user,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error en /api/auth/login:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
