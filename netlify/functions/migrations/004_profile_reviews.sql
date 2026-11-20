ALTER TABLE student_profiles ADD COLUMN phone TEXT NOT NULL DEFAULT '';
CREATE TABLE session_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  learning_session_id TEXT NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(learning_session_id,student_id)
);
