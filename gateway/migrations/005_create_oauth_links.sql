-- OAuth provider links
CREATE TABLE IF NOT EXISTS oauth_links (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider   VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    email      VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_links_user ON oauth_links(user_id);

-- Add OAuth-related columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';
