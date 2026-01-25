-- ═══════════════════════════════════════════════════════════
-- Data Redundancy Migration
-- Add author_display_name to posts for feed independence
-- ═══════════════════════════════════════════════════════════

-- Purpose: Eliminate cross-database JOINs between community_db and auth_db
-- The author's display name is denormalized into posts table

BEGIN;

-- 1. Add column if not exists
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS author_display_name VARCHAR(255);

-- 2. Add column for cached author avatar
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;

-- 3. Backfill existing posts (one-time sync)
-- Note: This requires the profiles table to be accessible
-- In production with separate DBs, use the RabbitMQ event system instead
UPDATE posts p
SET 
    author_display_name = COALESCE(
        (SELECT display_name FROM profiles WHERE id = p.author_id),
        'Usuario'
    ),
    author_avatar_url = (SELECT avatar_url FROM profiles WHERE id = p.author_id)
WHERE author_display_name IS NULL;

-- 4. Create index for author lookups
CREATE INDEX IF NOT EXISTS idx_posts_author_display_name 
ON posts(author_display_name);

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- Event Handler for Profile Updates
-- ═══════════════════════════════════════════════════════════
-- 
-- When profile.updated event is received via RabbitMQ:
-- 
-- UPDATE posts 
-- SET 
--     author_display_name = :new_display_name,
--     author_avatar_url = :new_avatar_url
-- WHERE author_id = :user_id;
--
-- This is handled by the Community Service event listener
-- ═══════════════════════════════════════════════════════════
