CREATE TABLE IF NOT EXISTS bookmarks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id  VARCHAR(500) NOT NULL,
    platform    VARCHAR(50) NOT NULL,
    title       TEXT NOT NULL,
    url         TEXT NOT NULL,
    thumbnail_url TEXT,
    author      VARCHAR(255),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, content_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
