-- Track B: Content analytics - click tracking
CREATE TABLE IF NOT EXISTS content_clicks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    tile_id       UUID REFERENCES tiles(id) ON DELETE SET NULL,
    content_id    VARCHAR(500) NOT NULL,
    platform      VARCHAR(50) NOT NULL,
    title         VARCHAR(500),
    url           TEXT NOT NULL,
    clicked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clicks_user_workspace ON content_clicks(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_clicks_platform ON content_clicks(platform);
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON content_clicks(clicked_at);
