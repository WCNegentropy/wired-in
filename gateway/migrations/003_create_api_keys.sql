CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform    VARCHAR(50) NOT NULL,
    key_name    VARCHAR(100) NOT NULL DEFAULT 'default',
    key_value   TEXT NOT NULL,
    key_secret  TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, platform, key_name)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_platform ON api_keys(user_id, platform);
