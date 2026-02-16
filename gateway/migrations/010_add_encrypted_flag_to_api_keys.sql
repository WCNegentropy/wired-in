-- Track E: Flag to track which API keys have been encrypted
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT false;
