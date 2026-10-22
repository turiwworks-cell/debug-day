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
