CREATE TABLE IF NOT EXISTS workspace_shares (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    share_token  VARCHAR(64) NOT NULL UNIQUE,
    permission   VARCHAR(20) NOT NULL DEFAULT 'view',
    created_by   UUID NOT NULL REFERENCES users(id),
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active    BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_shares_token ON workspace_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_shares_workspace ON workspace_shares(workspace_id);
