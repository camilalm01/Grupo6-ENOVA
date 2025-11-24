// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Seguridad mínima: evitar que cargue en cliente
if (!supabaseUrl || !serviceKey) {
  throw new Error("Supabase Service Role Key o URL no configurados.");
}

// Cliente con privilegios de administrador
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

export async function GET() {
  try {
    // Lista completa de usuarios
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error("❌ Error obteniendo usuarios:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data.users }, { status: 200 });
  } catch (err) {
    console.error("❌ Error en /api/admin/users:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
