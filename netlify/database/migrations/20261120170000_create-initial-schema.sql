-- ===================================================================
--  TREVY — Initial PostgreSQL schema for Netlify Database
--  Applied automatically by Netlify during deploys. Do not edit once applied;
--  add a new migration file for further schema changes.
-- ===================================================================

-- 1. USERS & AUTENTIKASI
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','tutor','admin')),
  status TEXT NOT NULL DEFAULT 'active',
  profile_photo_upload_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. ROLES, PERMISSIONS & RBAC
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_system INT NOT NULL DEFAULT 1 CHECK(is_system IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by TEXT REFERENCES users(id),
  PRIMARY KEY(user_id, role_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS user_groups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS user_group_members (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, group_id)
);

-- 3. UPLOADS & AUDIT
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('branding_logo','branding_favicon','profile_photo','tutor_document')),
  storage_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK(size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  changes TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. PENGATURAN TENANT / PLATFORM
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id TEXT PRIMARY KEY,
  platform_name TEXT NOT NULL DEFAULT 'Portal Les Privat Semarang',
  logo_upload_id TEXT,
  favicon_upload_id TEXT,
  primary_color TEXT NOT NULL DEFAULT '#4f46e5',
  tagline TEXT NOT NULL DEFAULT 'Belajar lebih mudah bersama pengajar berkualitas',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  currency TEXT NOT NULL DEFAULT 'IDR',
  language TEXT NOT NULL DEFAULT 'id',
  payment_settings TEXT NOT NULL DEFAULT '{}',
  security_settings TEXT NOT NULL DEFAULT '{}',
  operations_settings TEXT NOT NULL DEFAULT '{}',
  notification_settings TEXT NOT NULL DEFAULT '{}',
  finance_settings TEXT NOT NULL DEFAULT '{}',
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. AKADEMIK (MAPEL, GURU, SISWA, JADWAL)
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  is_active INT NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  grade TEXT NOT NULL DEFAULT '',
  school TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  free_trial_available INT NOT NULL DEFAULT 1 CHECK(free_trial_available IN (0,1))
);

CREATE TABLE IF NOT EXISTS student_subjects (
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY(student_id, subject_id)
);

CREATE TABLE IF NOT EXISTS tutor_details (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  university TEXT NOT NULL DEFAULT '',
  major TEXT NOT NULL DEFAULT '',
  education_level TEXT NOT NULL DEFAULT '',
  experience_years INT NOT NULL DEFAULT 0 CHECK(experience_years >= 0),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','verified','rejected')),
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tutor_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  availability_json TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tutor_subjects (
  tutor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY(tutor_id, subject_id)
);

CREATE TABLE IF NOT EXISTS tutor_availability (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  tutor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  CHECK(starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS tutor_wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available BIGINT NOT NULL DEFAULT 0 CHECK(available >= 0)
);

-- 6. PAKET, SUBSKRIPSI & TRANSAKSI
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  package_key TEXT NOT NULL,
  price BIGINT NOT NULL CHECK(price >= 0),
  session_count INT NOT NULL CHECK(session_count > 0),
  duration_minutes INT NOT NULL DEFAULT 90 CHECK(duration_minutes > 0),
  is_active INT NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  UNIQUE(tenant_id, package_key)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  remaining INT NOT NULL DEFAULT 6,
  total INT NOT NULL DEFAULT 8
);

CREATE TABLE IF NOT EXISTS learning_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  student_id TEXT NOT NULL REFERENCES users(id),
  package_id TEXT NOT NULL REFERENCES packages(id),
  remaining INT NOT NULL CHECK(remaining >= 0),
  total INT NOT NULL CHECK(total >= 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','cancelled'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  amount BIGINT NOT NULL,
  gateway TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL REFERENCES users(id),
  bank TEXT NOT NULL,
  account TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK(amount >= 100000),
  status TEXT NOT NULL CHECK(status IN ('pending_admin','transferred','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ
);

-- 7. SESI PEMBELAJARAN, PRESENSI & REVIEW
CREATE TABLE IF NOT EXISTS learning_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  student_id TEXT NOT NULL REFERENCES users(id),
  tutor_id TEXT REFERENCES users(id),
  subject_id TEXT REFERENCES subjects(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','matched','ongoing','completed','cancelled')),
  is_free_trial INT NOT NULL DEFAULT 0 CHECK(is_free_trial IN (0,1)),
  checkin_at TIMESTAMPTZ,
  checkout_at TIMESTAMPTZ,
  topic TEXT,
  reviewed INT NOT NULL DEFAULT 0 CHECK(reviewed IN (0,1))
);

CREATE TABLE IF NOT EXISTS tutor_active_sessions (
  tutor_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES users(id),
  learning_session_id TEXT REFERENCES learning_sessions(id),
  student_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL REFERENCES users(id),
  student_id TEXT REFERENCES users(id),
  learning_session_id TEXT REFERENCES learning_sessions(id),
  student_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending_review','approved','rejected')),
  honor BIGINT NOT NULL DEFAULT 100000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ,
  checkin_latitude DOUBLE PRECISION,
  checkin_longitude DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS attendance_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  tutor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learning_session_id TEXT REFERENCES learning_sessions(id) ON DELETE SET NULL,
  attendance_id TEXT REFERENCES attendance(id) ON DELETE CASCADE,
  storage_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK(size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  learning_session_id TEXT NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learning_session_id, student_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  preferences TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_status_created ON attendance(status, created_at);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created ON withdrawals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON user_roles(tenant_id, role_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_date ON audit_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_tutor_date ON learning_sessions(tutor_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_student_date ON learning_sessions(student_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_attendance_evidence_tutor ON attendance_evidence(tutor_id, created_at);

-- ───────────────────────────────────────────────────────────────────
--  DATA AWAL (SEEDS: ROLES, PERMISSIONS, TENANT, PACKAGES, MAPEL)
-- ───────────────────────────────────────────────────────────────────

INSERT INTO roles(id, role_key, display_name) VALUES
 ('role-admin', 'admin', 'Super Admin'),
 ('role-student', 'student', 'Siswa'),
 ('role-keuangan', 'keuangan', 'Keuangan'),
 ('role-guru', 'guru', 'Pengajar'),
 ('role-marketing', 'marketing', 'Marketing'),
 ('role-front-office', 'front_office', 'Front Office'),
 ('role-back-office', 'back_office', 'Back Office')
ON CONFLICT (id) DO NOTHING;

INSERT INTO permissions(id, permission_key, description) VALUES
 ('perm-admin', 'admin.manage', 'Administrasi dan konfigurasi penuh'),
 ('perm-student', 'student.dashboard', 'Mengakses dashboard siswa'),
 ('perm-tutor', 'tutor.dashboard', 'Mengakses dashboard pengajar'),
 ('perm-transaction', 'transaction.manage', 'Mengelola transaksi'),
 ('perm-accounting', 'accounting.manage', 'Mengakses keuangan dan akuntansi'),
 ('perm-payroll', 'payroll.manage', 'Mengelola payroll'),
 ('perm-withdrawal', 'withdrawal.manage', 'Mengelola penarikan honor'),
 ('perm-package', 'package.manage', 'Mengelola paket dan harga'),
 ('perm-promo', 'promo.manage', 'Mengelola promosi'),
 ('perm-enrollment', 'enrollment.report', 'Melihat laporan pendaftaran'),
 ('perm-people', 'people.manage', 'Mengelola data siswa dan pengajar'),
 ('perm-booking', 'booking.manage', 'Mengelola booking dan jadwal'),
 ('perm-docs', 'documents.basic_verify', 'Memverifikasi berkas dasar'),
 ('perm-tutor-verify', 'tutor.verify', 'Memverifikasi pengajar'),
 ('perm-attendance', 'attendance.manage', 'Mengelola presensi'),
 ('perm-operations', 'operations.manage', 'Mengelola operasional')
ON CONFLICT (id) DO NOTHING;

-- Relasi Role-Permissions
INSERT INTO role_permissions(role_id, permission_id)
 SELECT 'role-admin', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id) VALUES
 ('role-student', 'perm-student'),
 ('role-guru', 'perm-tutor'),
 ('role-keuangan', 'perm-transaction'),
 ('role-keuangan', 'perm-accounting'),
 ('role-keuangan', 'perm-payroll'),
 ('role-keuangan', 'perm-withdrawal'),
 ('role-marketing', 'perm-package'),
 ('role-marketing', 'perm-promo'),
 ('role-marketing', 'perm-enrollment'),
 ('role-front-office', 'perm-people'),
 ('role-front-office', 'perm-booking'),
 ('role-front-office', 'perm-docs'),
 ('role-back-office', 'perm-tutor-verify'),
 ('role-back-office', 'perm-attendance'),
 ('role-back-office', 'perm-operations')
ON CONFLICT DO NOTHING;

-- Pengaturan Tenant Default
INSERT INTO tenant_settings(tenant_id) VALUES('default')
ON CONFLICT (tenant_id) DO NOTHING;

-- Paket Layanan
INSERT INTO packages(id, tenant_id, name, package_key, price, session_count, duration_minutes) VALUES
 ('pkg-daily', 'default', 'Paket Harian', 'daily', 75000, 1, 90),
 ('pkg-monthly', 'default', 'Paket Bulanan', 'monthly', 499000, 8, 90),
 ('pkg-yearly', 'default', 'Paket Tahunan', 'yearly', 4499000, 96, 90)
ON CONFLICT (tenant_id, package_key) DO NOTHING;

-- Mata Pelajaran
INSERT INTO subjects(id, tenant_id, name) VALUES
 ('sub-math', 'default', 'Matematika'),
 ('sub-english', 'default', 'Bahasa Inggris'),
 ('sub-physics', 'default', 'Fisika'),
 ('sub-chemistry', 'default', 'Kimia'),
 ('sub-biology', 'default', 'Biologi'),
 ('sub-indonesian', 'default', 'Bahasa Indonesia'),
 ('sub-computer', 'default', 'Komputer'),
 ('sub-economics', 'default', 'Ekonomi')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Super Admin User Bootstrap (admin@trevy.id)
INSERT INTO users (id, name, email, password_hash, role, status) VALUES
 ('USR-ADMIN-PROD', 'Administrator', 'admin@trevy.id', 'scrypt$125aa92bca8f3d77a8615b5671086931$444b10796d17ee6c9c62d5f871d62d5aeb87e210349febd47ebe94569af2de0c9c70d304c061c018e7a670e0616fdfc76f012923350dd59e0c44f622e83c5141', 'admin', 'active')
ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'active';

INSERT INTO user_roles (user_id, role_id, tenant_id)
 SELECT id, 'role-admin', 'default' FROM users WHERE email = 'admin@trevy.id'
ON CONFLICT DO NOTHING;
