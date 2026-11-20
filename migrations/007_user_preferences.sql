CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  preferences TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
