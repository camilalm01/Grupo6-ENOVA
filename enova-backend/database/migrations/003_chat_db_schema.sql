-- ═══════════════════════════════════════════════════════════
-- ENOVA CHAT DATABASE SCHEMA
-- Base de datos independiente para Chat Service
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
    
    -- Estado de presencia
    is_online BOOLEAN DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ,
    
    -- Control de sincronización
    source_version BIGINT DEFAULT 1,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_user_cache_online ON user_cache(is_online) WHERE is_online = TRUE;

-- ───────────────────────────────────────────────────────────
-- TABLA: rooms
-- Salas de chat
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificación
    name TEXT,
    slug TEXT UNIQUE,
    description TEXT,
    avatar_url TEXT,
    
    -- Tipo de sala
    type TEXT DEFAULT 'public' CHECK (type IN ('public', 'private', 'direct', 'group')),
    
    -- Para salas directas (1-1)
    direct_user_1 UUID,
    direct_user_2 UUID,
    
    -- Creador
    created_by UUID,
    
    -- Configuración
    max_members INT DEFAULT 100,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);
CREATE INDEX IF NOT EXISTS idx_rooms_direct ON rooms(direct_user_1, direct_user_2) WHERE type = 'direct';
CREATE INDEX IF NOT EXISTS idx_rooms_last_message ON rooms(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_archived ON rooms(is_archived) WHERE is_archived = FALSE;

-- Constraint para salas directas únicas
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_direct_unique 
    ON rooms(LEAST(direct_user_1, direct_user_2), GREATEST(direct_user_1, direct_user_2)) 
    WHERE type = 'direct';

-- ───────────────────────────────────────────────────────────
-- TABLA: room_members
-- Miembros de salas
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Rol en la sala
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'moderator', 'owner')),
    
    -- Estado
    is_muted BOOLEAN DEFAULT FALSE,
    muted_until TIMESTAMPTZ,
    
    -- Tracking de lectura
    last_read_at TIMESTAMPTZ,
    unread_count INT DEFAULT 0,
    
    -- Timestamps
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_unread ON room_members(unread_count) WHERE unread_count > 0;

-- ───────────────────────────────────────────────────────────
-- TABLA: messages
-- Mensajes de chat
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    
    -- Autor (identificador lógico)
    user_id UUID NOT NULL,
    
    -- Data redundante del usuario (para mostrar sin join)
    username TEXT,
    user_avatar_url TEXT,
    
    -- Contenido
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video', 'system', 'reply')),
    
    -- Para replies
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    -- Attachments (JSON para flexibilidad)
    attachments JSONB,
    
    -- Estado
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    -- Anonimización (para Saga de eliminación de cuenta)
    anonymized_at TIMESTAMPTZ,
    original_user_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Para migración
    legacy_id UUID,
    migrated_at TIMESTAMPTZ
);

-- Índices optimizados para chat
CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_legacy ON messages(legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Índice para búsqueda de mensajes
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages 
    USING GIN(to_tsvector('spanish', content)) 
    WHERE deleted_at IS NULL;

-- ───────────────────────────────────────────────────────────
-- TABLA: message_reactions
-- Reacciones a mensajes
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);

-- ───────────────────────────────────────────────────────────
-- TABLA: message_read_receipts
-- Confirmaciones de lectura
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_read_receipts (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_user ON message_read_receipts(user_id, read_at DESC);

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

DROP TRIGGER IF EXISTS trigger_rooms_updated ON rooms;
CREATE TRIGGER trigger_rooms_updated
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Función para sincronizar datos del usuario desde cache
CREATE OR REPLACE FUNCTION sync_message_user_from_cache()
RETURNS TRIGGER AS $$
BEGIN
    SELECT display_name, avatar_url 
    INTO NEW.username, NEW.user_avatar_url
    FROM user_cache 
    WHERE user_id = NEW.user_id AND NOT is_deleted;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_messages_sync_user ON messages;
CREATE TRIGGER trigger_messages_sync_user
    BEFORE INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION sync_message_user_from_cache();

-- Función para actualizar last_message_at en rooms
CREATE OR REPLACE FUNCTION update_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE rooms SET last_message_at = NEW.created_at WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_room_last_message ON messages;
CREATE TRIGGER trigger_room_last_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_room_last_message();

-- Función para incrementar unread_count de miembros
CREATE OR REPLACE FUNCTION update_members_unread()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE room_members 
    SET unread_count = unread_count + 1
    WHERE room_id = NEW.room_id 
      AND user_id != NEW.user_id
      AND left_at IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_members_unread ON messages;
CREATE TRIGGER trigger_members_unread
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_members_unread();

-- Función para crear sala directa (1-1)
CREATE OR REPLACE FUNCTION get_or_create_direct_room(user1 UUID, user2 UUID)
RETURNS UUID AS $$
DECLARE
    room_id UUID;
BEGIN
    -- Buscar sala existente
    SELECT id INTO room_id
    FROM rooms
    WHERE type = 'direct'
      AND ((direct_user_1 = user1 AND direct_user_2 = user2)
        OR (direct_user_1 = user2 AND direct_user_2 = user1));
    
    -- Si no existe, crear
    IF room_id IS NULL THEN
        INSERT INTO rooms (type, direct_user_1, direct_user_2)
        VALUES ('direct', LEAST(user1, user2), GREATEST(user1, user2))
        RETURNING id INTO room_id;
        
        -- Agregar miembros
        INSERT INTO room_members (room_id, user_id) VALUES (room_id, user1), (room_id, user2);
    END IF;
    
    RETURN room_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- FIN DEL SCHEMA enova_chat_db
-- ═══════════════════════════════════════════════════════════
