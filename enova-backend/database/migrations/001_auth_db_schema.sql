-- ═══════════════════════════════════════════════════════════
-- ENOVA AUTH DATABASE SCHEMA
-- Base de datos independiente para Auth Service
-- ═══════════════════════════════════════════════════════════

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────────────────────────────────────────
-- TABLA: profiles
-- Almacena información de perfiles de usuarias
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Metadata para sincronización con otros servicios
    sync_version BIGINT DEFAULT 1,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Para migración desde DB legacy
    legacy_id UUID,
    migrated_at TIMESTAMPTZ
);

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted ON profiles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_sync ON profiles(sync_version);
CREATE INDEX IF NOT EXISTS idx_profiles_legacy ON profiles(legacy_id) WHERE legacy_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────
-- TABLA: user_sessions
-- Tracking de sesiones activas (opcional, para analytics)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    device_info JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- ───────────────────────────────────────────────────────────
-- TABLA: profile_audit_log
-- Auditoría de cambios en perfiles (para compensación de Saga)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
    old_data JSONB,
    new_data JSONB,
    performed_by UUID,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    correlation_id UUID
);

CREATE INDEX IF NOT EXISTS idx_audit_profile ON profile_audit_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON profile_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON profile_audit_log(correlation_id);

-- ───────────────────────────────────────────────────────────
-- FUNCIONES Y TRIGGERS
-- ───────────────────────────────────────────────────────────

-- Función para auto-actualizar updated_at y sync_version
CREATE OR REPLACE FUNCTION update_profile_metadata()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.sync_version = COALESCE(OLD.sync_version, 0) + 1;
    NEW.last_sync_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para profiles
DROP TRIGGER IF EXISTS trigger_profiles_metadata ON profiles;
CREATE TRIGGER trigger_profiles_metadata
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_profile_metadata();

-- Función para logging de auditoría
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO profile_audit_log (profile_id, action, new_data)
        VALUES (NEW.id, 'create', to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO profile_audit_log (profile_id, action, old_data, new_data)
        VALUES (NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO profile_audit_log (profile_id, action, old_data)
        VALUES (OLD.id, 'delete', to_jsonb(OLD));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger de auditoría
DROP TRIGGER IF EXISTS trigger_profiles_audit ON profiles;
CREATE TRIGGER trigger_profiles_audit
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION log_profile_changes();

-- ───────────────────────────────────────────────────────────
-- DATOS INICIALES (para testing)
-- ───────────────────────────────────────────────────────────
-- INSERT INTO profiles (id, email, display_name, role)
-- VALUES 
--     ('00000000-0000-0000-0000-000000000001', 'admin@enova.com', 'Admin ENOVA', 'admin'),
--     ('00000000-0000-0000-0000-000000000002', 'test@enova.com', 'Test User', 'user');

-- ═══════════════════════════════════════════════════════════
-- FIN DEL SCHEMA enova_auth_db
-- ═══════════════════════════════════════════════════════════
