-- Idempotent: applying this again never removes existing planner data.
CREATE TABLE IF NOT EXISTS planner (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 data TEXT NOT NULL CHECK (json_valid(data)),
 revision INTEGER NOT NULL CHECK (revision > 0),
 updated_at TEXT NOT NULL
);
-- Keep the last twenty accepted revisions for recovery outside the browser.
CREATE TABLE IF NOT EXISTS planner_history (
 revision INTEGER PRIMARY KEY,
 data TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS planner_history_update
AFTER UPDATE ON planner
BEGIN
 INSERT OR IGNORE INTO planner_history (revision, data, updated_at)
 VALUES (OLD.revision, OLD.data, OLD.updated_at);
 DELETE FROM planner_history WHERE revision < NEW.revision - 20;
END;

-- OAuth state is separate from planner data. Existing MCP keys continue to work.
CREATE TABLE IF NOT EXISTS oauth_clients (id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_pending (id TEXT PRIMARY KEY, nonce_hash TEXT NOT NULL, data TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS oauth_grants (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, resource TEXT NOT NULL, scope TEXT NOT NULL, access TEXT NOT NULL, key_hash TEXT NOT NULL, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS oauth_codes (hash TEXT PRIMARY KEY, grant_id TEXT NOT NULL, redirect_uri TEXT NOT NULL, challenge TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_tokens (hash TEXT PRIMARY KEY, grant_id TEXT NOT NULL, kind TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS oauth_tokens_grant ON oauth_tokens(grant_id);
