CREATE TABLE attendance_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  tutor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learning_session_id TEXT REFERENCES learning_sessions(id) ON DELETE SET NULL,
  storage_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  created_at TEXT NOT NULL
);
ALTER TABLE attendance_evidence ADD COLUMN attendance_id TEXT REFERENCES attendance(id) ON DELETE CASCADE;
CREATE INDEX idx_attendance_evidence_tutor ON attendance_evidence(tutor_id,created_at);
