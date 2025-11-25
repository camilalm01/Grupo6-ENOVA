--------------------------------------------------------------------------------
-- 1. TABLA PROFILES (PERFILES DE USUARIO)
--------------------------------------------------------------------------------

-- Si estás en desarrollo y no te importa borrar perfiles anteriores:
drop table if exists profiles cascade;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Activar RLS
alter table profiles enable row level security;

-- Eliminar policies anteriores para evitar duplicados (si existen)
drop policy if exists "Usuarios pueden ver perfiles" on profiles;
drop policy if exists "Puede ver su perfil" on profiles;
drop policy if exists "Usuarios pueden actualizar su propio perfil" on profiles;

-- 👀 Cualquier usuaria autenticada puede ver perfiles
-- (necesario para que el feed vea el nombre/avatar de otras)
create policy "Usuarios pueden ver perfiles"
on profiles for select
to authenticated
using (true);

-- Solo cada usuaria puede actualizar SU propio perfil
create policy "Usuarios pueden actualizar su propio perfil"
on profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


--------------------------------------------------------------------------------
-- 2. TRIGGER PARA CREAR/AJUSTAR PERFIL AL REGISTRARSE
--------------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
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
-- 3. TABLA POSTS (PUBLICACIONES DEL FEED)
--------------------------------------------------------------------------------

-- No la borramos, solo la creamos si no existe
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content text not null,
  tags text[] default '{}',
  image_url text,
  created_at timestamptz default now()
);

-- Activar RLS
alter table posts enable row level security;

-- Asegurar que la FK de posts.user_id → profiles.id existe y apunta bien
alter table posts
drop constraint if exists posts_user_id_fkey;

alter table posts
add constraint posts_user_id_fkey
foreign key (user_id)
references profiles(id)
on delete cascade;


--------------------------------------------------------------------------------
-- 4. POLICIES COMPLETAS PARA POSTS (CRUD SEGURO)
--------------------------------------------------------------------------------

-- Borramos policies previas para no duplicar nombres ni lógicas
drop policy if exists "Puede ver posts" on posts;
drop policy if exists "Puede crear sus posts" on posts;
drop policy if exists "Puede editar sus posts" on posts;
drop policy if exists "Puede eliminar sus posts" on posts;
drop policy if exists "permitir actualizar propio post" on posts;

-- R = READ (ver todos los posts de todas)
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


--------------------------------------------------------------------------------
-- 5. RECARGAR ESQUEMA DE POSTGREST
--------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
