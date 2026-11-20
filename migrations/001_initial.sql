
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','tutor','admin')),
    status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    remaining INTEGER NOT NULL DEFAULT 6, total INTEGER NOT NULL DEFAULT 8
  );
  CREATE TABLE IF NOT EXISTS tutor_wallets (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    available INTEGER NOT NULL DEFAULT 0 CHECK(available >= 0)
  );
  CREATE TABLE IF NOT EXISTS tutor_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bank_code TEXT NOT NULL DEFAULT '', account_number TEXT NOT NULL DEFAULT '', account_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '', availability_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tutor_active_sessions (
    tutor_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL, subject TEXT NOT NULL, started_at TEXT NOT NULL,
    latitude REAL, longitude REAL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
    description TEXT NOT NULL, amount INTEGER NOT NULL, gateway TEXT NOT NULL,
    status TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', idempotency_key TEXT UNIQUE, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY, tutor_id TEXT NOT NULL REFERENCES users(id), student_name TEXT NOT NULL,
    subject TEXT NOT NULL, topic TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending_review','approved','rejected')),
    honor INTEGER NOT NULL DEFAULT 100000, created_at TEXT NOT NULL, reviewed_at TEXT,
    checkin_latitude REAL, checkin_longitude REAL
  );
  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY, tutor_id TEXT NOT NULL REFERENCES users(id), bank TEXT NOT NULL,
    account TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 100000),
    status TEXT NOT NULL CHECK(status IN ('pending_admin','transferred','rejected')),
    created_at TEXT NOT NULL, reviewed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL,
    target_type TEXT NOT NULL, target_id TEXT, details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_attendance_status_created ON attendance(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created ON withdrawals(status, created_at);

