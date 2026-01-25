-- ═══════════════════════════════════════════════════════════
-- ENOVA COMMUNITY DATABASE SCHEMA
-- Base de datos independiente para Community Service
-- ═══════════════════════════════════════════════════════════

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────────────────────────────────────────
-- TABLA: user_cache
-- Cache de usuarios para evitar joins cross-service
-- Sincronizado via eventos desde Auth Service
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_cache (
    user_id UUID PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    
    -- Control de sincronización
    source_version BIGINT DEFAULT 1,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    is_stale BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_user_cache_stale ON user_cache(is_stale) WHERE is_stale = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_cache_deleted ON user_cache(is_deleted) WHERE is_deleted = TRUE;

-- ───────────────────────────────────────────────────────────
-- TABLA: categories
-- Categorías de posts
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    icon TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías por defecto
INSERT INTO categories (name, slug, description, color) VALUES
    ('General', 'general', 'Discusiones generales', '#6B7280'),
    ('Recursos', 'recursos', 'Compartir recursos útiles', '#10B981'),
    ('Eventos', 'eventos', 'Anuncios de eventos', '#8B5CF6'),
    ('Apoyo', 'apoyo', 'Red de apoyo comunitario', '#EC4899'),
    ('Preguntas', 'preguntas', 'Preguntas y respuestas', '#F59E0B')
ON CONFLICT (slug) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- TABLA: posts
-- Posts de la comunidad
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificador lógico del autor (NO FK física)
    author_id UUID NOT NULL,
    
    -- Data redundante del autor (desnormalización controlada)
    -- Se actualiza via eventos cuando el usuario cambia su perfil
    author_display_name TEXT,
    author_avatar_url TEXT,
    
    -- Contenido
    title TEXT NOT NULL,
    slug TEXT,
    content TEXT NOT NULL,
    excerpt TEXT,
    
    -- Categorización
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    
    -- Estado
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived', 'flagged')),
    is_pinned BOOLEAN DEFAULT FALSE,
    
    -- Engagement (counters desnormalizados para performance)
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    views_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Para migración desde DB legacy
    legacy_id UUID,
    migrated_at TIMESTAMPTZ
);

-- Índices para posts
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts(is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_deleted ON posts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_legacy ON posts(legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN(tags);

-- Índice para búsqueda full-text
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts 
    USING GIN(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, '')));

-- ───────────────────────────────────────────────────────────
-- TABLA: post_likes
-- Likes de posts (para evitar duplicados)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_likes (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_user ON post_likes(user_id);

-- ───────────────────────────────────────────────────────────
-- TABLA: comments
-- Comentarios en posts
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    
    -- Autor (identificador lógico)
    author_id UUID NOT NULL,
    author_display_name TEXT,
    author_avatar_url TEXT,
    
    -- Contenido
    content TEXT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- ───────────────────────────────────────────────────────────
-- FUNCIONES Y TRIGGERS
-- ───────────────────────────────────────────────────────────

-- Función para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de updated_at
DROP TRIGGER IF EXISTS trigger_posts_updated ON posts;
CREATE TRIGGER trigger_posts_updated
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_comments_updated ON comments;
CREATE TRIGGER trigger_comments_updated
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Función para sincronizar datos del autor desde user_cache
CREATE OR REPLACE FUNCTION sync_author_from_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Obtener datos actualizados del cache
    SELECT display_name, avatar_url 
    INTO NEW.author_display_name, NEW.author_avatar_url
    FROM user_cache 
    WHERE user_id = NEW.author_id AND NOT is_deleted;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar autor en INSERT
DROP TRIGGER IF EXISTS trigger_posts_sync_author ON posts;
CREATE TRIGGER trigger_posts_sync_author
    BEFORE INSERT ON posts
    FOR EACH ROW EXECUTE FUNCTION sync_author_from_cache();

DROP TRIGGER IF EXISTS trigger_comments_sync_author ON comments;
CREATE TRIGGER trigger_comments_sync_author
    BEFORE INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION sync_author_from_cache();

-- Función para actualizar contadores de likes
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_likes_count ON post_likes;
CREATE TRIGGER trigger_likes_count
    AFTER INSERT OR DELETE ON post_likes
    FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Función para actualizar contadores de comentarios
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_comments_count ON comments;
CREATE TRIGGER trigger_comments_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Función para generar slug único
CREATE OR REPLACE FUNCTION generate_post_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INT := 0;
BEGIN
    -- Generar slug base del título
    base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    base_slug := substring(base_slug, 1, 100);
    
    final_slug := base_slug;
    
    -- Asegurar unicidad
    WHILE EXISTS (SELECT 1 FROM posts WHERE slug = final_slug AND id != NEW.id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := final_slug;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_posts_slug ON posts;
CREATE TRIGGER trigger_posts_slug
    BEFORE INSERT OR UPDATE OF title ON posts
    FOR EACH ROW 
    WHEN (NEW.slug IS NULL OR NEW.slug = '')
    EXECUTE FUNCTION generate_post_slug();

-- ═══════════════════════════════════════════════════════════
-- FIN DEL SCHEMA enova_community_db
-- ═══════════════════════════════════════════════════════════
