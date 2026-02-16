-- Track A: Saved searches for push notifications
CREATE TABLE IF NOT EXISTS saved_searches (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    query         VARCHAR(500) NOT NULL,
    platforms     TEXT[] NOT NULL DEFAULT '{}',
    notify        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_notify ON saved_searches(notify) WHERE notify = true;
