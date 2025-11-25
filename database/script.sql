--------------------------------------------------------------------------------
-- MIGRACIÓN COMPLETA - PLATAFORMA DE AUTONOMÍA FEMENINA (ENOVA)
-- Ejecutar en el SQL Editor de Supabase
-- Fecha: 2025
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
-- 0. LIMPIEZA PREVIA (DESARROLLO) - COMENTAR EN PRODUCCIÓN
--------------------------------------------------------------------------------
-- ⚠️ CUIDADO: Esto borra todos los datos existentes
drop table if exists chat_messages cascade;
drop table if exists posts cascade;
drop table if exists profiles cascade;

--------------------------------------------------------------------------------
-- 1. TABLA PROFILES (PERFILES DE USUARIO)
--------------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  email text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Activar RLS
alter table profiles enable row level security;

-- Eliminar policies anteriores para evitar duplicados
drop policy if exists "Usuarios pueden ver perfiles" on profiles;
drop policy if exists "Puede ver su perfil" on profiles;
drop policy if exists "Usuarios pueden actualizar su propio perfil" on profiles;
drop policy if exists "Usuarios pueden insertar su perfil" on profiles;

-- Cualquier usuaria autenticada puede ver perfiles
create policy "Usuarios pueden ver perfiles"
on profiles for select
to authenticated
using (true);

-- Cada usuaria puede insertar su propio perfil
create policy "Usuarios pueden insertar su perfil"
on profiles for insert
to authenticated
with check (auth.uid() = id);

-- Solo cada usuaria puede actualizar SU propio perfil
create policy "Usuarios pueden actualizar su propio perfil"
on profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Índice para búsquedas por email
create index if not exists idx_profiles_email on profiles(email);

--------------------------------------------------------------------------------
-- 2. TRIGGER PARA CREAR/AJUSTAR PERFIL AL REGISTRARSE
--------------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    email = coalesce(excluded.email, profiles.email),
    updated_at = now();

  return new;
end;
$$;

-- Recrear trigger de auth.users → profiles
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

--------------------------------------------------------------------------------
-- 3. TABLA POSTS (PUBLICACIONES DEL FEED/DASHBOARD)
--------------------------------------------------------------------------------

create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  tags text[] default '{}',
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Activar RLS
alter table posts enable row level security;

-- Eliminar policies previas
drop policy if exists "Puede ver posts" on posts;
drop policy if exists "Puede crear sus posts" on posts;
drop policy if exists "Puede editar sus posts" on posts;
drop policy if exists "Puede eliminar sus posts" on posts;

-- R = READ (ver todos los posts)
create policy "Puede ver posts"
on posts for select
to authenticated
using (true);

-- C = CREATE (crear solo sus posts)
create policy "Puede crear sus posts"
on posts for insert
to authenticated
with check (auth.uid() = user_id);

-- U = UPDATE (editar solo sus posts)
create policy "Puede editar sus posts"
on posts for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- D = DELETE (eliminar solo sus posts)
create policy "Puede eliminar sus posts"
on posts for delete
to authenticated
using (auth.uid() = user_id);

-- Índices para optimización
create index if not exists idx_posts_user_id on posts(user_id);
create index if not exists idx_posts_created_at on posts(created_at desc);

--------------------------------------------------------------------------------
-- 4. TABLA CHAT_MESSAGES (MENSAJES DEL CHAT EN TIEMPO REAL)
--------------------------------------------------------------------------------

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id varchar(255) not null,  -- VARCHAR para soportar IDs de Supabase Auth
  content text not null check (char_length(content) > 0 and char_length(content) <= 2000),
  room_id varchar(255) not null,
  username varchar(255),
  created_at timestamptz default now() not null,
  read_at timestamptz,
  deleted_at timestamptz
);

-- Activar RLS
alter table chat_messages enable row level security;

-- Eliminar policies previas
drop policy if exists "Todos pueden leer mensajes" on chat_messages;
drop policy if exists "Todos pueden enviar mensajes" on chat_messages;
drop policy if exists "Usuarios pueden leer mensajes" on chat_messages;
drop policy if exists "Usuarios pueden enviar mensajes" on chat_messages;

-- Políticas para chat (acceso abierto a usuarios autenticados)
create policy "Todos pueden leer mensajes"
on chat_messages for select
to authenticated
using (true);

create policy "Todos pueden enviar mensajes"
on chat_messages for insert
to authenticated
with check (true);

-- También permitir acceso anónimo para demo (opcional, comentar en producción)
create policy "Acceso anónimo lectura mensajes"
on chat_messages for select
to anon
using (true);

create policy "Acceso anónimo envío mensajes"
on chat_messages for insert
to anon
with check (true);

-- Índices para optimización del chat
create index if not exists idx_chat_messages_room_id on chat_messages(room_id);
create index if not exists idx_chat_messages_room_created on chat_messages(room_id, created_at desc);
create index if not exists idx_chat_messages_user_id on chat_messages(user_id);

--------------------------------------------------------------------------------
-- 5. TRIGGER PARA USERNAME EN CHAT_MESSAGES
--------------------------------------------------------------------------------

create or replace function ensure_username()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Si no hay username, usar un valor por defecto
  if new.username is null or new.username = '' then
    new.username := 'Usuario Anónimo';
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_ensure_username on chat_messages;

create trigger trigger_ensure_username
before insert on chat_messages
for each row execute function ensure_username();

--------------------------------------------------------------------------------
-- 6. FUNCIÓN PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
--------------------------------------------------------------------------------

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger para profiles
drop trigger if exists update_profiles_updated_at on profiles;
create trigger update_profiles_updated_at
before update on profiles
for each row execute function update_updated_at_column();

-- Trigger para posts
drop trigger if exists update_posts_updated_at on posts;
create trigger update_posts_updated_at
before update on posts
for each row execute function update_updated_at_column();

--------------------------------------------------------------------------------
-- 7. VISTAS ÚTILES (OPCIONAL)
--------------------------------------------------------------------------------

-- Vista de posts con información del autor
create or replace view posts_with_author as
select
  p.id,
  p.user_id,
  p.content,
  p.tags,
  p.image_url,
  p.created_at,
  pr.full_name as author_name,
  pr.avatar_url as author_avatar
from posts p
left join profiles pr on p.user_id = pr.id
order by p.created_at desc;

--------------------------------------------------------------------------------
-- 8. DATOS DE EJEMPLO (OPCIONAL - COMENTAR EN PRODUCCIÓN)
--------------------------------------------------------------------------------

-- Nota: En Supabase, los usuarios se crean a través de auth.users
-- Estos datos de ejemplo solo funcionarán si ya existen usuarios en auth.users
--
-- Para crear usuarios de prueba, usa el panel de Supabase:
-- Authentication > Users > Add User
--
-- Usuarios sugeridos para testing:
-- - luz@enova.com (full_name: Luz Andrade)
-- - dayana@enova.com (full_name: Dayana Lema)
-- - paula@enova.com (full_name: Paula Lopez)
-- - jahir@enova.com (full_name: Jahir Rocha)

--------------------------------------------------------------------------------
-- 9. RECARGAR ESQUEMA DE POSTGREST
--------------------------------------------------------------------------------
notify pgrst, 'reload schema';

--------------------------------------------------------------------------------
-- ✅ MIGRACIÓN COMPLETADA
--
-- Tablas creadas:
-- - profiles: Perfiles de usuario (vinculados a auth.users)
-- - posts: Publicaciones del feed/dashboard
-- - chat_messages: Mensajes del chat en tiempo real
--
-- Características:
-- - Row Level Security (RLS) activado en todas las tablas
-- - Triggers automáticos para created_at/updated_at
-- - Índices optimizados para búsquedas frecuentes
-- - Soporte para chat en tiempo real con Socket.io
--------------------------------------------------------------------------------
