CREATE TABLE IF NOT EXISTS workspaces (
    id          UUID PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tiles (
    id                      UUID PRIMARY KEY,
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform                VARCHAR(50) NOT NULL CHECK (platform IN ('reddit', 'youtube', 'x', 'rss', 'news')),
    config                  JSONB NOT NULL DEFAULT '{}',
    position_x              INT NOT NULL DEFAULT 0,
    position_y              INT NOT NULL DEFAULT 0,
    position_w              INT NOT NULL DEFAULT 4,
    position_h              INT NOT NULL DEFAULT 3,
    refresh_interval_secs   BIGINT NOT NULL DEFAULT 300,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiles_workspace_id ON tiles(workspace_id);
