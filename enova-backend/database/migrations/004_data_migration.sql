-- ═══════════════════════════════════════════════════════════
-- SCRIPT DE MIGRACIÓN DE DATOS
-- Migrar datos desde DB legacy a las nuevas DBs
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- PASO 1: Migrar profiles a enova_auth_db
-- Ejecutar conectado a enova_auth_db
-- ───────────────────────────────────────────────────────────

-- Usar dblink para conectar a la DB legacy
-- CREATE EXTENSION IF NOT EXISTS dblink;

-- Migración de profiles
INSERT INTO profiles (
    id, email, display_name, avatar_url, bio, role,
    created_at, updated_at, deleted_at,
    legacy_id, migrated_at
)
SELECT 
    p.id,
    p.email,
    p.display_name,
    p.avatar_url,
    p.bio,
    COALESCE(p.role, 'user'),
    p.created_at,
    p.updated_at,
    p.deleted_at,
    p.id AS legacy_id,
    NOW() AS migrated_at
FROM dblink(
    'dbname=legacy_db host=db.xxx.supabase.co',
    'SELECT id, email, display_name, avatar_url, bio, role, created_at, updated_at, deleted_at FROM profiles'
) AS p(
    id UUID, email TEXT, display_name TEXT, avatar_url TEXT, 
    bio TEXT, role TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    updated_at = EXCLUDED.updated_at;

-- ───────────────────────────────────────────────────────────
-- PASO 2: Poblar user_cache en enova_community_db
-- Ejecutar conectado a enova_community_db
-- ───────────────────────────────────────────────────────────

INSERT INTO user_cache (user_id, display_name, avatar_url, role, source_version)
SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    p.role,
    p.sync_version
FROM dblink(
    'dbname=enova_auth_db',
    'SELECT id, display_name, avatar_url, role, sync_version FROM profiles WHERE deleted_at IS NULL'
) AS p(id UUID, display_name TEXT, avatar_url TEXT, role TEXT, sync_version BIGINT)
ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    source_version = EXCLUDED.source_version,
    cached_at = NOW();

-- Migrar posts
INSERT INTO posts (
    id, author_id, author_display_name, author_avatar_url,
    title, content, category_id,
    created_at, updated_at, deleted_at,
    legacy_id, migrated_at
)
SELECT 
    p.id,
    p.author_id,
    uc.display_name,
    uc.avatar_url,
    p.title,
    p.content,
    (SELECT id FROM categories WHERE slug = 'general' LIMIT 1),
    p.created_at,
    p.updated_at,
    p.deleted_at,
    p.id AS legacy_id,
    NOW() AS migrated_at
FROM dblink(
    'dbname=legacy_db host=db.xxx.supabase.co',
    'SELECT id, author_id, title, content, category, created_at, updated_at, deleted_at FROM posts'
) AS p(
    id UUID, author_id UUID, title TEXT, content TEXT, 
    category TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
)
LEFT JOIN user_cache uc ON uc.user_id = p.author_id
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    updated_at = EXCLUDED.updated_at;

-- ───────────────────────────────────────────────────────────
-- PASO 3: Poblar user_cache en enova_chat_db
-- Ejecutar conectado a enova_chat_db
-- ───────────────────────────────────────────────────────────

INSERT INTO user_cache (user_id, display_name, avatar_url, source_version)
SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    p.sync_version
FROM dblink(
    'dbname=enova_auth_db',
    'SELECT id, display_name, avatar_url, sync_version FROM profiles WHERE deleted_at IS NULL'
) AS p(id UUID, display_name TEXT, avatar_url TEXT, sync_version BIGINT)
ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    source_version = EXCLUDED.source_version,
    cached_at = NOW();

-- Crear sala pública por defecto
INSERT INTO rooms (id, name, slug, type, description)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'General',
    'general',
    'public',
    'Sala de chat general de ENOVA'
)
ON CONFLICT (id) DO NOTHING;

-- Migrar mensajes
INSERT INTO messages (
    id, room_id, user_id, username, user_avatar_url,
    content, message_type, created_at,
    legacy_id, migrated_at
)
SELECT 
    m.id,
    COALESCE(m.room_id, '00000000-0000-0000-0000-000000000001'),
    m.user_id,
    COALESCE(m.username, uc.display_name),
    uc.avatar_url,
    m.content,
    'text',
    m.created_at,
    m.id AS legacy_id,
    NOW() AS migrated_at
FROM dblink(
    'dbname=legacy_db host=db.xxx.supabase.co',
    'SELECT id, room_id, user_id, username, content, created_at FROM chat_messages'
) AS m(id UUID, room_id UUID, user_id UUID, username TEXT, content TEXT, created_at TIMESTAMPTZ)
LEFT JOIN user_cache uc ON uc.user_id = m.user_id
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- VERIFICACIÓN DE MIGRACIÓN
-- ───────────────────────────────────────────────────────────

-- Verificar conteos
DO $$
DECLARE
    legacy_profiles INT;
    new_profiles INT;
    legacy_posts INT;
    new_posts INT;
    legacy_messages INT;
    new_messages INT;
BEGIN
    -- Obtener conteos de legacy
    SELECT COUNT(*) INTO legacy_profiles FROM dblink(
        'dbname=legacy_db', 'SELECT 1 FROM profiles WHERE deleted_at IS NULL'
    ) AS t(x INT);
    
    SELECT COUNT(*) INTO legacy_posts FROM dblink(
        'dbname=legacy_db', 'SELECT 1 FROM posts WHERE deleted_at IS NULL'
    ) AS t(x INT);
    
    SELECT COUNT(*) INTO legacy_messages FROM dblink(
        'dbname=legacy_db', 'SELECT 1 FROM chat_messages'
    ) AS t(x INT);
    
    -- Comparar (esto se ejecutaría en cada DB nueva)
    RAISE NOTICE 'Legacy profiles: %, Legacy posts: %, Legacy messages: %', 
        legacy_profiles, legacy_posts, legacy_messages;
END;
$$ LANGUAGE plpgsql;
