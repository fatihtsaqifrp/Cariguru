CREATE TABLE tenant_settings (
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
  updated_at TEXT NOT NULL
);
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 1 CHECK(is_system IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id,permission_id)
);
CREATE TABLE user_groups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id,name)
);
CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  assigned_at TEXT NOT NULL,
  assigned_by TEXT REFERENCES users(id),
  PRIMARY KEY(user_id, role_id, tenant_id)
);
CREATE TABLE user_group_members (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  PRIMARY KEY(user_id,group_id)
);
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('branding_logo','branding_favicon','profile_photo','tutor_document')),
  storage_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  created_at TEXT NOT NULL
);
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  changes TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE student_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  grade TEXT NOT NULL DEFAULT '',
  school TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  free_trial_available INTEGER NOT NULL DEFAULT 1 CHECK(free_trial_available IN (0,1))
);
CREATE TABLE tutor_details (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  university TEXT NOT NULL DEFAULT '',
  major TEXT NOT NULL DEFAULT '',
  education_level TEXT NOT NULL DEFAULT '',
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK(experience_years >= 0),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','verified','rejected')),
  verified_at TEXT
);
CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  UNIQUE(tenant_id,name)
);
CREATE TABLE tutor_subjects (
  tutor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY(tutor_id,subject_id)
);
CREATE TABLE student_subjects (
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY(student_id,subject_id)
);
CREATE TABLE tutor_availability (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  tutor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  CHECK(starts_at < ends_at)
);
CREATE TABLE packages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  package_key TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  session_count INTEGER NOT NULL CHECK(session_count > 0),
  duration_minutes INTEGER NOT NULL DEFAULT 90 CHECK(duration_minutes > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  UNIQUE(tenant_id,package_key)
);
CREATE TABLE learning_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  student_id TEXT NOT NULL REFERENCES users(id),
  package_id TEXT NOT NULL REFERENCES packages(id),
  remaining INTEGER NOT NULL CHECK(remaining >= 0),
  total INTEGER NOT NULL CHECK(total >= 0),
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','cancelled'))
);
CREATE TABLE learning_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  student_id TEXT NOT NULL REFERENCES users(id),
  tutor_id TEXT REFERENCES users(id),
  subject_id TEXT REFERENCES subjects(id),
  scheduled_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','matched','ongoing','completed','cancelled')),
  is_free_trial INTEGER NOT NULL DEFAULT 0 CHECK(is_free_trial IN (0,1)),
  checkin_at TEXT,
  checkout_at TEXT,
  topic TEXT,
  reviewed INTEGER NOT NULL DEFAULT 0 CHECK(reviewed IN (0,1))
);
CREATE INDEX idx_user_roles_tenant ON user_roles(tenant_id,role_id);
CREATE INDEX idx_audit_log_tenant_date ON audit_log(tenant_id,created_at);
CREATE INDEX idx_uploads_user ON uploads(user_id,created_at);
CREATE INDEX idx_learning_sessions_tutor_date ON learning_sessions(tutor_id,scheduled_at);
CREATE INDEX idx_learning_sessions_student_date ON learning_sessions(student_id,scheduled_at);

INSERT INTO roles(id,role_key,display_name,created_at) VALUES
 ('role-admin','admin','Super Admin',CURRENT_TIMESTAMP),
 ('role-student','student','Siswa',CURRENT_TIMESTAMP),
 ('role-keuangan','keuangan','Keuangan',CURRENT_TIMESTAMP),
 ('role-guru','guru','Pengajar',CURRENT_TIMESTAMP),
 ('role-marketing','marketing','Marketing',CURRENT_TIMESTAMP),
 ('role-front-office','front_office','Front Office',CURRENT_TIMESTAMP),
 ('role-back-office','back_office','Back Office',CURRENT_TIMESTAMP);
INSERT INTO permissions(id,permission_key,description) VALUES
 ('perm-admin','admin.manage','Administrasi dan konfigurasi penuh'),
 ('perm-student','student.dashboard','Mengakses dashboard siswa'),
 ('perm-tutor','tutor.dashboard','Mengakses dashboard pengajar'),
 ('perm-transaction','transaction.manage','Mengelola transaksi'),
 ('perm-accounting','accounting.manage','Mengakses keuangan dan akuntansi'),
 ('perm-payroll','payroll.manage','Mengelola payroll'),
 ('perm-withdrawal','withdrawal.manage','Mengelola penarikan honor'),
 ('perm-package','package.manage','Mengelola paket dan harga'),
 ('perm-promo','promo.manage','Mengelola promosi'),
 ('perm-enrollment','enrollment.report','Melihat laporan pendaftaran'),
 ('perm-people','people.manage','Mengelola data siswa dan pengajar'),
 ('perm-booking','booking.manage','Mengelola booking dan jadwal'),
 ('perm-docs','documents.basic_verify','Memverifikasi berkas dasar'),
 ('perm-tutor-verify','tutor.verify','Memverifikasi pengajar'),
 ('perm-attendance','attendance.manage','Mengelola presensi'),
 ('perm-operations','operations.manage','Mengelola operasional');
INSERT INTO role_permissions(role_id,permission_id)
 SELECT 'role-admin',id FROM permissions;
INSERT INTO role_permissions(role_id,permission_id) VALUES
 ('role-student','perm-student'),
 ('role-guru','perm-tutor'),
 ('role-keuangan','perm-transaction'),('role-keuangan','perm-accounting'),('role-keuangan','perm-payroll'),('role-keuangan','perm-withdrawal'),
 ('role-marketing','perm-package'),('role-marketing','perm-promo'),('role-marketing','perm-enrollment'),
 ('role-front-office','perm-people'),('role-front-office','perm-booking'),('role-front-office','perm-docs'),
 ('role-back-office','perm-tutor-verify'),('role-back-office','perm-attendance'),('role-back-office','perm-operations');
INSERT INTO user_roles(user_id,role_id,tenant_id,assigned_at)
 SELECT id,CASE role WHEN 'admin' THEN 'role-admin' WHEN 'student' THEN 'role-student' ELSE 'role-guru' END,'default',created_at FROM users;
INSERT INTO tenant_settings(tenant_id,updated_at) VALUES('default',CURRENT_TIMESTAMP);
INSERT INTO packages(id,tenant_id,name,package_key,price,session_count,duration_minutes) VALUES
 ('pkg-daily','default','Paket Harian','daily',75000,1,90),
 ('pkg-monthly','default','Paket Bulanan','monthly',499000,8,90),
 ('pkg-yearly','default','Paket Tahunan','yearly',4499000,96,90);
INSERT INTO subjects(id,tenant_id,name) VALUES
 ('sub-math','default','Matematika'),('sub-english','default','Bahasa Inggris'),('sub-physics','default','Fisika'),('sub-chemistry','default','Kimia'),('sub-biology','default','Biologi'),('sub-indonesian','default','Bahasa Indonesia'),('sub-computer','default','Komputer'),('sub-economics','default','Ekonomi');

