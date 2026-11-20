/* Trevy development application server. Financial actions are server-owned. */
const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const Database = require('better-sqlite3');
const fs = require('node:fs');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV !== 'development';
const COOKIE_NAME = 'trevy_session';
const scrypt = promisify(crypto.scrypt);
if (process.platform !== 'win32') process.umask(0o077);
const dbPath = process.env.TREVY_DB_PATH || path.join(__dirname, '..', 'trevy-data', 'trevy.sqlite');
require('node:fs').mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
const db = new Database(dbPath);
if (process.platform !== 'win32') require('node:fs').chmodSync(dbPath, 0o600);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
function runMigrations() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const migrationDir = path.join(__dirname, 'migrations');
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map(row => row.version));
  for (const filename of require('node:fs').readdirSync(migrationDir).filter(name => /\.(sql|js)$/.test(name)).sort()) {
    if (applied.has(filename)) continue;
    db.transaction(() => {
      if(filename.endsWith('.sql')) db.exec(require('node:fs').readFileSync(path.join(migrationDir, filename), 'utf8'));
      else require(path.join(migrationDir,filename))(db);
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run(filename, new Date().toISOString());
    })();
  }
}
runMigrations();
const uploadDir = process.env.TREVY_UPLOAD_DIR || path.join(path.dirname(dbPath), 'trevy-uploads');
fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
if (process.platform !== 'win32') fs.chmodSync(uploadDir, 0o700);

const now = () => new Date().toISOString();
function standardSessionRate() {
  const settings=db.prepare("SELECT operations_settings FROM tenant_settings WHERE tenant_id='default'").get();
  const rate=Number(JSON.parse(settings?.operations_settings||'{}').standardRate);
  return Number.isSafeInteger(rate)&&rate>=0?rate:100000;
}
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const constantTimeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const candidate = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64));
  return constantTimeEqual(candidate.toString('hex'), hashHex);
}

function audit(actorId, action, targetType, targetId, details = {}) {
  const auditId = id('AUD'); const createdAt = now(); const serialized = JSON.stringify(details);
  db.prepare('INSERT INTO audit_events (id, actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(auditId, actorId || null, action, targetType, targetId || null, serialized, createdAt);
  db.prepare('INSERT INTO audit_log(id,tenant_id,actor_id,action,entity_type,entity_id,changes,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(auditId, 'default', actorId || null, action, targetType, targetId || null, serialized, createdAt);
}

async function seedDevelopmentUsers() {
  if (IS_PRODUCTION) {
    const email = process.env.TREVY_ADMIN_EMAIL;
    const password = process.env.TREVY_ADMIN_PASSWORD;
    if (!email || !password || password.length < 14) {
      throw new Error('Production requires TREVY_ADMIN_EMAIL and a TREVY_ADMIN_PASSWORD of at least 14 characters.');
    }
    const seededDemos = db.prepare("SELECT count(*) AS count FROM users WHERE email IN ('siswa@trevy.id','guru@trevy.id','admin@trevy.id')").get().count;
    if (seededDemos) throw new Error('Development demo users exist in this database. Production must use a clean, separate TREVY_DB_PATH.');
    const admin = db.prepare('SELECT id,role FROM users WHERE email = ?').get(email.toLowerCase());
    if (admin && (admin.role !== 'admin' || db.prepare("SELECT 1 FROM user_roles WHERE user_id=? AND role_id='role-admin'").get(admin.id) === undefined)) throw new Error('TREVY_ADMIN_EMAIL must belong to an account assigned the super-admin role.');
    const passwordHash = await hashPassword(password);
    if (!admin) {
      const adminId = id('USR');
      db.prepare('INSERT INTO users (id,name,email,password_hash,role,status,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(adminId, 'Administrator', email.toLowerCase(), passwordHash, 'admin', 'active', now());
      db.prepare("INSERT OR IGNORE INTO user_roles(user_id,role_id,tenant_id,assigned_at) VALUES(?,'role-admin','default',?)").run(adminId, now());
    } else db.prepare("UPDATE users SET password_hash=?,status='active' WHERE id=?").run(passwordHash, admin.id);
    if (admin) db.prepare("INSERT OR IGNORE INTO user_roles(user_id,role_id,tenant_id,assigned_at) VALUES(?,'role-admin','default',?)").run(admin.id, now());
    return;
  }

  const demos = [
    ['USR-DEMO-STUDENT', 'Dina Fauziah', 'siswa@trevy.id', 'siswa123', 'student'],
    ['USR-DEMO-TUTOR', 'Budi Wicaksono', 'guru@trevy.id', 'guru123', 'tutor'],
    ['USR-DEMO-ADMIN', 'Trevy Admin', 'admin@trevy.id', 'admin123', 'admin']
  ];
  for (const [userId, name, email, password, role] of demos) {
    if (!db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      db.prepare('INSERT INTO users (id,name,email,password_hash,role,status,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(userId, name, email, await hashPassword(password), role, 'active', now());
    }
    const roleKey = role === 'admin' ? 'admin' : role === 'tutor' ? 'guru' : 'student';
    db.prepare('INSERT OR IGNORE INTO user_roles(user_id,role_id,tenant_id,assigned_at) SELECT ?,id,\'default\',? FROM roles WHERE role_key=?').run(userId, now(), roleKey);
    if (role === 'student') {
      db.prepare('INSERT OR IGNORE INTO subscriptions(user_id,remaining,total) VALUES(?,6,8)').run(userId);
      db.prepare('INSERT OR IGNORE INTO student_profiles(user_id,tenant_id) VALUES(?,\'default\')').run(userId);
    }
    if (role === 'tutor') {
      db.prepare('INSERT OR IGNORE INTO tutor_wallets(user_id,available) VALUES(?,2400000)').run(userId);
      db.prepare("INSERT OR IGNORE INTO tutor_details(user_id,tenant_id,verification_status,verified_at) VALUES(?,'default','verified',?)").run(userId,now());
      const demoAvailability=JSON.stringify([{day:'Senin',time:'14:00 - 17:00'},{day:'Selasa',time:'09:00 - 12:00'},{day:'Sabtu',time:'08:00 - 16:00'}]);
      db.prepare("INSERT OR IGNORE INTO tutor_profiles(user_id,availability_json,updated_at) VALUES(?,?,?)").run(userId,demoAvailability,now());
      db.prepare("UPDATE tutor_profiles SET availability_json=? WHERE user_id=? AND availability_json='[]'").run(demoAvailability,userId);
    }
  }
}

app.disable('x-powered-by');
app.set('trust proxy', IS_PRODUCTION ? 1 : false);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Cache-Control': 'no-store'
  });
  if (IS_PRODUCTION) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: '8mb', strict: true }));

const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  const registering = req.path.endsWith('/register');
  const identifier = String(req.body?.email || req.body?.username || '').trim().toLowerCase();
  const identityHash = crypto.createHash('sha256').update(identifier).digest('hex');
  const key = registering ? `register:${req.ip}` : `login:${req.ip}:${identityHash}`;
  res.locals.loginRateLimitKey = key;
  const time = Date.now();
  const state = loginAttempts.get(key) || { count: 0, resetAt: time + 15 * 60 * 1000 };
  if (state.resetAt <= time) { state.count = 0; state.resetAt = time + 15 * 60 * 1000; }
  state.count += 1;
  loginAttempts.set(key, state);
  if (state.count > 10) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit.' });
  next();
}

function getSession(req) {
  const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  let decodedToken;
  try { decodedToken = decodeURIComponent(token); } catch { return null; }
  const row = db.prepare(`SELECT sessions.token_hash, sessions.csrf_token, sessions.expires_at,
    users.id, users.name, users.email, users.role AS legacy_role, users.status, users.profile_photo_upload_id,
    COALESCE((SELECT roles.role_key FROM user_roles JOIN roles ON roles.id=user_roles.role_id WHERE user_roles.user_id=users.id AND user_roles.tenant_id='default' ORDER BY CASE roles.role_key WHEN 'admin' THEN 0 ELSE 1 END LIMIT 1), CASE users.role WHEN 'tutor' THEN 'guru' ELSE users.role END) AS role
    FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=?`).get(hashToken(decodedToken));
  const configuredTtl = Number(JSON.parse(db.prepare("SELECT security_settings FROM tenant_settings WHERE tenant_id='default'").get()?.security_settings||'{}').sessionTimeoutMinutes);
  const ttlMs = Number.isInteger(configuredTtl) && configuredTtl >= 5 && configuredTtl <= 1440 ? configuredTtl*60*1000 : 8*60*60*1000;
  if (!row || row.expires_at <= Date.now() || row.status !== 'active' || Date.now()-Date.parse(row.created_at) > ttlMs) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(row.token_hash);
    return null;
  }
  return row;
}

function requireAuth(role) {
  return (req, res, next) => {
    const session = getSession(req);
    if (!session) return req.path.startsWith('/api/') ? res.status(401).json({ error: 'Sesi tidak berlaku. Silakan masuk kembali.' }) : res.redirect('/login.html');
    const expectedRole = role === 'tutor' ? 'guru' : role;
    if (expectedRole && session.role !== expectedRole) {
      return req.path.startsWith('/api/') ? res.status(403).json({ error: 'Akses tidak diizinkan.' }) : res.status(403).send('Akses tidak diizinkan.');
    }
    req.user = session;
    next();
  };
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    const user = req.user || getSession(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak berlaku. Silakan masuk kembali.' });
    if (user.role === 'admin') { req.user = user; return next(); }
    const allowed = db.prepare(`SELECT 1 FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id=ur.role_id
      JOIN permissions p ON p.id=rp.permission_id
      WHERE ur.user_id=? AND ur.tenant_id='default' AND p.permission_key=? LIMIT 1`).get(user.id, permissionKey);
    if (!allowed) return res.status(403).json({ error: 'Akses tidak diizinkan untuk tindakan ini.' });
    req.user = user;
    next();
  };
}

function encryptionKey() {
  const raw = process.env.TREVY_ENCRYPTION_KEY || '';
  const key = /^[a-f\d]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('TREVY_ENCRYPTION_KEY harus berisi 32 byte dalam format base64 atau 64 karakter hex.');
  return key;
}
function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), value: ciphertext.toString('base64') };
}
function decryptSecret(secret) {
  if (!secret?.iv || !secret?.tag || !secret?.value) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(secret.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(secret.value, 'base64')), decipher.final()]).toString('utf8');
}
function paymentSettings() {
  return JSON.parse(db.prepare("SELECT payment_settings FROM tenant_settings WHERE tenant_id='default'").get()?.payment_settings || '{}');
}
function providerSecret(payment, provider, field) {
  return decryptSecret(payment.secrets?.[provider]?.[field]);
}
function publicSettings(row) {
  const payment = JSON.parse(row.payment_settings || '{}');
  const secrets = payment.secrets || {};
  payment.secretStatus = Object.fromEntries(Object.entries(secrets).map(([provider, fields]) => [provider, Object.fromEntries(Object.keys(fields).map(key => [key, '••••••••']))]));
  delete payment.secrets;
  return {
    branding: { platformName: row.platform_name, tagline: row.tagline, primaryColor: row.primary_color, logoUrl: row.logo_upload_id ? `/api/media/${encodeURIComponent(row.logo_upload_id)}` : '', faviconUrl: row.favicon_upload_id ? `/api/media/${encodeURIComponent(row.favicon_upload_id)}` : '' },
    general: { contactEmail: row.contact_email, contactPhone: row.contact_phone, address: row.address, timezone: row.timezone, currency: row.currency, language: row.language },
    payment: { ...payment, provider: payment.provider || 'midtrans' },
    security: JSON.parse(row.security_settings || '{}'),
    operations: JSON.parse(row.operations_settings || '{}'),
    notifications: JSON.parse(row.notification_settings || '{}'),
    finance: JSON.parse(row.finance_settings || '{}'),
    updatedAt: row.updated_at
  };
}

app.get('/api/tenant/branding', (_req, res) => {
  const row = db.prepare('SELECT platform_name,tagline,primary_color,logo_upload_id,favicon_upload_id,contact_email,contact_phone,address,timezone,currency,language,updated_at FROM tenant_settings WHERE tenant_id=\'default\'').get();
  if (!row) return res.status(503).json({ error: 'Pengaturan platform belum tersedia.' });
  const settings=publicSettings({ ...row, payment_settings: '{}', security_settings: '{}', operations_settings: '{}', notification_settings: '{}', finance_settings: '{}' });
  res.json({ ...settings.branding, ...settings.general });
});
app.get('/api/tenant/payment-provider', (_req,res)=>{
  const payment=paymentSettings();
  const provider=['midtrans','xendit'].includes(payment.provider)?payment.provider:'midtrans';
  const keyConfigured=Boolean(providerSecret(payment,provider,provider==='midtrans'?'serverKey':'secretKey'));
  const webhookReady=typeof payment.webhookReady==='object'?Boolean(payment.webhookReady[provider]):Boolean(payment.webhookReady);
  const webhookConfigured=webhookReady&&(provider==='midtrans'||Boolean(providerSecret(payment,provider,'webhookVerificationToken')));
  const biSnapConfigured=Boolean(payment.merchantId&&payment.biSnapClientId&&payment.biSnapPartnerId&&/^\d{5}$/.test(String(payment.biSnapChannelId||''))&&providerSecret(payment,'midtrans','biSnapClientSecret')&&providerSecret(payment,'midtrans','biSnapPrivateKey')&&payment.biSnapMerchantPublicKey&&payment.biSnapNotificationPublicKey);
  const mode=payment.mode||'sandbox';
  res.json({provider,mode,configured:mode!=='simulator'&&keyConfigured&&webhookConfigured,simulator:!IS_PRODUCTION&&(mode==='simulator'||!keyConfigured),biSnapConfigured});
});
app.get('/api/admin/settings', requireAuth('admin'), requirePermission('admin.manage'), (_req, res) => {
  res.json(publicSettings(db.prepare("SELECT * FROM tenant_settings WHERE tenant_id='default'").get()));
});
app.put('/api/admin/settings/:section', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, (req, res) => {
  const section = String(req.params.section);
  const data = req.body?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Data pengaturan tidak valid.' });
  const allowed = new Set(['branding','general','payment','security','operations','notifications','finance']);
  if (!allowed.has(section)) return res.status(404).json({ error: 'Bagian pengaturan tidak ditemukan.' });
  const current = db.prepare("SELECT * FROM tenant_settings WHERE tenant_id='default'").get();
  const updated = { ...data };
  if (section === 'branding') {
    const name = String(data.platformName || '').trim(); const tagline = String(data.tagline || '').trim(); const color = String(data.primaryColor || '');
    if (!name || name.length > 100 || tagline.length > 180 || !/^#[0-9a-f]{6}$/i.test(color)) return res.status(400).json({ error: 'Nama (1–100), tagline (maksimal 180), dan warna hex valid wajib diisi.' });
    db.prepare("UPDATE tenant_settings SET platform_name=?,tagline=?,primary_color=?,updated_by=?,updated_at=? WHERE tenant_id='default'").run(name, tagline, color, req.user.id, now());
    updated.platformName = name; updated.tagline = tagline; updated.primaryColor = color;
  } else if (section === 'general') {
    const email = String(data.contactEmail || '').trim(); const phone = String(data.contactPhone || '').trim(); const address = String(data.address || '').trim();
    const timezone = String(data.timezone || 'Asia/Jakarta'); const currency = String(data.currency || 'IDR'); const language = String(data.language || 'id');
    if ((email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || email.length > 160 || phone.length > 30 || address.length > 500 || !['Asia/Jakarta','Asia/Makassar','Asia/Jayapura','UTC'].includes(timezone) || !['IDR','USD'].includes(currency) || !['id','en'].includes(language)) return res.status(400).json({ error: 'Kontak, alamat, zona waktu, mata uang, atau bahasa tidak valid.' });
    db.prepare("UPDATE tenant_settings SET contact_email=?,contact_phone=?,address=?,timezone=?,currency=?,language=?,updated_by=?,updated_at=? WHERE tenant_id='default'").run(email,phone,address,timezone,currency,language,req.user.id,now());
  } else {
    const column = { payment:'payment_settings', security:'security_settings', operations:'operations_settings', notifications:'notification_settings', finance:'finance_settings' }[section];
    let stored = JSON.parse(current[column] || '{}');
    if (section === 'payment') {
      if (!['midtrans','xendit'].includes(data.provider)) return res.status(400).json({ error: 'Provider tidak valid.' });
      if (data.mode && !['simulator','sandbox','production','test','live'].includes(data.mode)) return res.status(400).json({ error: 'Mode provider tidak valid.' });
      if (data.biSnapMode && !['sandbox','staging','production'].includes(data.biSnapMode)) return res.status(400).json({ error: 'Environment BI-SNAP tidak valid.' });
      if (String(data.callbackUrl || '').length > 500 || String(data.webhookUrl || '').length > 500) return res.status(400).json({ error: 'URL callback/webhook terlalu panjang.' });
      if (data.biSnapChannelId && !/^\d{5}$/.test(String(data.biSnapChannelId))) return res.status(400).json({ error: 'Channel ID BI-SNAP harus terdiri dari 5 digit.' });
      if (data.biSnapClientId && String(data.biSnapClientId).length > 100 || data.biSnapPartnerId && String(data.biSnapPartnerId).length > 100 || data.biSnapClientSecret && String(data.biSnapClientSecret).length > 500 || data.biSnapPrivateKey && (String(data.biSnapPrivateKey).length > 20000 || !String(data.biSnapPrivateKey).includes('-----BEGIN PRIVATE KEY-----') || !String(data.biSnapPrivateKey).includes('-----END PRIVATE KEY-----')) || data.biSnapMerchantPublicKey && String(data.biSnapMerchantPublicKey).length > 20000 || data.biSnapNotificationPublicKey && String(data.biSnapNotificationPublicKey).length > 20000) return res.status(400).json({ error: 'Format atau ukuran kredensial BI-SNAP tidak valid. Private key harus PKCS#8 PEM.' });
      const secretNames = data.provider === 'midtrans' ? ['serverKey'] : ['secretKey','webhookVerificationToken'];
      const secrets = { ...(stored.secrets || {}) };
      for (const key of secretNames) if (data[key]) secrets[data.provider] = { ...(secrets[data.provider] || {}), [key]: encryptSecret(data[key]) };
      for (const key of ['biSnapClientSecret','biSnapPrivateKey']) if (data[key]) secrets.midtrans = { ...(secrets.midtrans || {}), [key]: encryptSecret(data[key]) };
      const { serverKey, secretKey, webhookVerificationToken, biSnapClientSecret, biSnapPrivateKey, ...publicData } = data;
      stored = { ...stored, ...publicData, secrets };
      Object.assign(updated, publicData);
      delete updated.serverKey; delete updated.secretKey; delete updated.webhookVerificationToken; delete updated.biSnapClientSecret; delete updated.biSnapPrivateKey;
      updated.secretStatus = Object.fromEntries(Object.entries(secrets).map(([provider, fields]) => [provider, Object.fromEntries(Object.keys(fields).map(key => [key,'••••••••']))]));
    } else {
      if (section === 'security' && (!Number.isInteger(data.minimumPasswordLength) || data.minimumPasswordLength < 12 || data.minimumPasswordLength > 128 || !Number.isInteger(data.sessionTimeoutMinutes) || data.sessionTimeoutMinutes < 5 || data.sessionTimeoutMinutes > 1440)) return res.status(400).json({ error: 'Panjang sandi minimum harus 12–128 dan timeout sesi 5–1440 menit.' });
      if (section === 'operations' && (!Number.isSafeInteger(data.standardRate) || data.standardRate < 0 || !Number.isInteger(data.freeTrialQuota) || data.freeTrialQuota < 0 || data.freeTrialQuota > 20 || !Number.isInteger(data.sessionDurationMinutes) || data.sessionDurationMinutes < 15 || data.sessionDurationMinutes > 360)) return res.status(400).json({ error: 'Tarif, kuota trial, atau durasi sesi tidak valid.' });
      if (section === 'notifications' && (typeof data.enabled !== 'boolean' || typeof data.template !== 'string' || data.template.length > 2000)) return res.status(400).json({ error: 'Template notifikasi maksimal 2.000 karakter dan toggle harus boolean.' });
      if (section === 'finance' && (typeof data.coa !== 'string' || data.coa.length > 500 || !['Bulanan','Triwulanan','Tahunan'].includes(data.accountingPeriod))) return res.status(400).json({ error: 'COA atau periode akuntansi tidak valid.' });
      stored = { ...stored, ...data };
    }
    db.prepare(`UPDATE tenant_settings SET ${column}=?,updated_by=?,updated_at=? WHERE tenant_id='default'`).run(JSON.stringify(stored), req.user.id, now());
  }
  audit(req.user.id, `settings.${section}.updated`, 'tenant_settings', 'default', { fields: Object.keys(data) });
  res.json({ section, data: updated, message: 'Pengaturan berhasil disimpan.' });
});

app.post('/api/admin/branding/logo', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, (req, res) => {
  const { name, mimeType, data } = req.body || {};
  const purpose = req.body?.purpose === 'branding_favicon' ? 'branding_favicon' : 'branding_logo';
  if (!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(mimeType) || typeof data !== 'string' || data.length > 3_000_000) return res.status(400).json({ error: 'Format logo harus PNG, JPG, SVG, atau WebP dengan ukuran maksimal 2 MB.' });
  let buffer;
  try { buffer = Buffer.from(data, 'base64'); } catch { return res.status(400).json({ error: 'File gambar tidak valid.' }); }
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Ukuran logo maksimal 2 MB.' });
  const signatures = { 'image/png': buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'image/jpeg': buffer[0]===255 && buffer[1]===216 && buffer[2]===255, 'image/webp': buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP' };
  if (mimeType === 'image/svg+xml') {
    const svg = buffer.toString('utf8');
    if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg) || /<script|\bon\w+\s*=|javascript:|<foreignObject|(?:href|src)\s*=\s*["'](?!#)/i.test(svg)) return res.status(400).json({ error: 'SVG berisi elemen yang tidak aman.' });
  } else if (!signatures[mimeType]) return res.status(400).json({ error: 'Isi file tidak sesuai tipe gambar.' });
  const extension = { 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg' }[mimeType];
  const storageName = `${crypto.randomUUID()}.${extension}`; fs.writeFileSync(path.join(uploadDir, storageName), buffer, { mode: 0o600, flag: 'wx' });
  const uploadId = id('UPL');
  db.transaction(() => {
    db.prepare('INSERT INTO uploads(id,tenant_id,user_id,purpose,storage_name,original_name,mime_type,size_bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(uploadId,'default',req.user.id,purpose,storageName,String(name || 'logo').slice(0,180),mimeType,buffer.length,now());
    const column = purpose === 'branding_favicon' ? 'favicon_upload_id' : 'logo_upload_id';
    db.prepare(`UPDATE tenant_settings SET ${column}=?,updated_by=?,updated_at=? WHERE tenant_id='default'`).run(uploadId,req.user.id,now());
    audit(req.user.id,'settings.branding.logo_updated','tenant_settings','default',{uploadId,mimeType,size:buffer.length});
  })();
  res.status(201).json({ uploadId, url: `/api/media/${encodeURIComponent(uploadId)}` });
});
app.get('/api/media/:id', (req, res) => {
  const upload = db.prepare("SELECT storage_name,mime_type FROM uploads WHERE id=? AND tenant_id='default' AND purpose IN ('branding_logo','branding_favicon')").get(req.params.id);
  if (!upload) return res.sendStatus(404);
  res.type(upload.mime_type).set('Content-Disposition','inline').sendFile(path.join(uploadDir, upload.storage_name));
});
app.post('/api/account/uploads',requireAuth(),requireCsrf,(req,res)=>{
  const purpose=req.body?.purpose;const name=String(req.body?.name||'file').slice(0,180),mimeType=req.body?.mimeType,data=req.body?.data;
  if(!['profile_photo','tutor_document'].includes(purpose)||!['image/png','image/jpeg','image/webp','application/pdf'].includes(mimeType)||typeof data!=='string'||data.length>7_000_000)return res.status(400).json({error:'Jenis atau ukuran file tidak diizinkan.'});
  let buffer;try{buffer=Buffer.from(data,'base64');}catch{return res.status(400).json({error:'File tidak valid.'});}
  const limit=purpose==='profile_photo'?2*1024*1024:5*1024*1024;
  const valid= mimeType==='image/png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mimeType==='image/jpeg'?buffer[0]===255&&buffer[1]===216&&buffer[2]===255:mimeType==='image/webp'?buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP':buffer.toString('ascii',0,5)==='%PDF-';
  if(!buffer.length||buffer.length>limit||!valid)return res.status(400).json({error:purpose==='profile_photo'?'Foto harus PNG, JPG, atau WebP maksimal 2 MB.':'Dokumen harus PDF atau gambar maksimal 5 MB.'});
  if(purpose==='tutor_document'&&req.user.role!=='guru')return res.status(403).json({error:'Unggah dokumen kualifikasi hanya tersedia untuk pengajar.'});
  const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf'}[mimeType],storageName=`${crypto.randomUUID()}.${extension}`,uploadId=id('UPL');
  fs.writeFileSync(path.join(uploadDir,storageName),buffer,{mode:0o600,flag:'wx'});
  db.transaction(()=>{
    db.prepare('INSERT INTO uploads(id,tenant_id,user_id,purpose,storage_name,original_name,mime_type,size_bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(uploadId,'default',req.user.id,purpose,storageName,name,mimeType,buffer.length,now());
    if(purpose==='profile_photo')db.prepare('UPDATE users SET profile_photo_upload_id=? WHERE id=?').run(uploadId,req.user.id);
    audit(req.user.id,`upload.${purpose}.created`,'upload',uploadId,{mimeType,size:buffer.length});
  })();
  res.status(201).json({id:uploadId,url:`/api/account/uploads/${encodeURIComponent(uploadId)}`,purpose});
});
app.get('/api/account/uploads',requireAuth(),(req,res)=>{
  res.json(db.prepare('SELECT id,purpose,original_name AS name,mime_type AS mimeType,size_bytes AS size,created_at AS createdAt FROM uploads WHERE user_id=? AND purpose IN (\'profile_photo\',\'tutor_document\') ORDER BY created_at DESC').all(req.user.id));
});
app.get('/api/account/uploads/:id',requireAuth(),(req,res)=>{
  const upload=db.prepare('SELECT user_id,storage_name,mime_type FROM uploads WHERE id=? AND tenant_id=\'default\' AND purpose IN (\'profile_photo\',\'tutor_document\')').get(req.params.id);
  if(!upload||upload.user_id!==req.user.id&&req.user.role!=='admin')return res.sendStatus(404);
  res.type(upload.mime_type).set('Content-Disposition','inline').sendFile(path.join(uploadDir,upload.storage_name));
});

function requireCsrf(req, res, next) {
  const session = req.user || getSession(req);
  const origin = req.get('origin');
  const expectedOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin && origin !== expectedOrigin) return res.status(403).json({ error: 'Origin tidak diizinkan.' });
  if (!session || !constantTimeEqual(req.get('x-csrf-token'), session.csrf_token)) return res.status(403).json({ error: 'Token keamanan tidak valid.' });
  req.user = session;
  next();
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.post('/api/auth/login', loginRateLimit, async (req, res) => {
  const identifier = String(req.body?.email || req.body?.username || '').trim();
  const email = identifier.toLowerCase();
  const password = String(req.body?.password || '');
  const requestedRole = String(req.body?.role || '');
  const user = db.prepare('SELECT * FROM users WHERE lower(email)=? OR lower(name)=? ORDER BY CASE WHEN lower(email)=? THEN 0 ELSE 1 END LIMIT 1').get(email,email,email);
  const assignedRoles = user && db.prepare(`SELECT r.role_key FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=? AND ur.tenant_id='default' ORDER BY CASE r.role_key WHEN 'admin' THEN 0 ELSE 1 END, r.role_key`).all(user.id);
  const requestedRoleKey = requestedRole === 'tutor' ? 'guru' : requestedRole;
  const role = requestedRoleKey ? assignedRoles?.find(item=>item.role_key===requestedRoleKey)?.role_key : assignedRoles?.[0]?.role_key;
  if (!user || user.status !== 'active' || !role || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Email, kata sandi, atau peran tidak sesuai.' });
  }
  loginAttempts.delete(res.locals.loginRateLimitKey);
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const configuredTtl = Number(JSON.parse(db.prepare("SELECT security_settings FROM tenant_settings WHERE tenant_id='default'").get()?.security_settings||'{}').sessionTimeoutMinutes);
  const expiresAt = Date.now() + (Number.isInteger(configuredTtl)&&configuredTtl>=5&&configuredTtl<=1440?configuredTtl*60*1000:8*60*60*1000);
  db.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)')
    .run(hashToken(rawToken), user.id, csrfToken, expiresAt, now());
  res.cookie(COOKIE_NAME, rawToken, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'strict', path: '/', maxAge: expiresAt-Date.now() });
  audit(user.id, 'login.success', 'session', null, { role });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role, profilePhotoUrl: user.profile_photo_upload_id ? `/api/account/uploads/${encodeURIComponent(user.profile_photo_upload_id)}` : '' }, csrfToken, redirect: role === 'admin' ? '/dashboard-admin.html' : role === 'guru' ? '/dashboard-tutor.html' : role === 'student' ? '/dashboard-student.html' : '/dashboard-staff.html' });
});

app.post('/api/auth/register', loginRateLimit, asyncRoute(async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 120);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const role = String(req.body?.role || '');
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !['student','tutor'].includes(role)) {
    return res.status(400).json({ error: 'Nama, email valid, peran, dan kata sandi minimal 12 karakter wajib diisi.' });
  }
  const userId = id('USR');
  const passwordHash = await hashPassword(password);
  try {
    db.transaction(() => {
      db.prepare('INSERT INTO users(id,name,email,password_hash,role,status,created_at) VALUES(?,?,?,?,?,?,?)').run(userId, name, email, passwordHash, role, role === 'tutor' ? 'pending_verification' : 'active', now());
      db.prepare('INSERT INTO user_roles(user_id,role_id,tenant_id,assigned_at) SELECT ?,id,\'default\',? FROM roles WHERE role_key=?').run(userId, now(), role === 'tutor' ? 'guru' : 'student');
      if (role === 'student') {
        db.prepare('INSERT INTO subscriptions(user_id,remaining,total) VALUES(?,0,0)').run(userId);
        db.prepare('INSERT INTO student_profiles(user_id,tenant_id) VALUES(?,\'default\')').run(userId);
      }
      if (role === 'tutor') {
        db.prepare('INSERT INTO tutor_wallets(user_id,available) VALUES(?,0)').run(userId);
        db.prepare('INSERT INTO tutor_details(user_id,tenant_id) VALUES(?,\'default\')').run(userId);
      }
      audit(userId, 'account.registered', 'user', userId, { role });
    })();
  } catch (error) { if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Email sudah digunakan.' }); throw error; }
  res.status(201).json({ message: role === 'tutor' ? 'Akun dibuat. Pengajar menunggu verifikasi Admin sebelum dapat masuk.' : 'Akun dibuat. Silakan masuk menggunakan email dan kata sandi.' });
}));

app.get('/api/auth/demo-account', (req, res) => {
  if (IS_PRODUCTION) return res.sendStatus(404);
  const accounts = {
    student: { email: 'siswa@trevy.id', password: 'siswa123' },
    tutor: { email: 'guru@trevy.id', password: 'guru123' },
    admin: { email: 'admin@trevy.id', password: 'admin123' }
  };
  const account = accounts[req.query.role];
  if (!account) return res.status(400).json({ error: 'Peran tidak valid.' });
  res.set('Cache-Control', 'no-store').json(account);
});

app.get('/api/auth/session', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Belum masuk.' });
  res.json({ user: { id: session.id, name: session.name, email: session.email, role: session.role, profilePhotoUrl: session.profile_photo_upload_id ? `/api/account/uploads/${encodeURIComponent(session.profile_photo_upload_id)}` : '' }, csrfToken: session.csrf_token });
});
app.get('/api/account/preferences',requireAuth(),(req,res)=>res.json(JSON.parse(db.prepare('SELECT preferences FROM user_preferences WHERE user_id=?').get(req.user.id)?.preferences||'{}')));
app.put('/api/account/preferences',requireAuth(),requireCsrf,(req,res)=>{
  const preferences=req.body?.preferences;
  if(!preferences||typeof preferences!=='object'||Array.isArray(preferences)||Object.keys(preferences).some(key=>!['waReminder','emailReminder','weeklySummary'].includes(key))||Object.values(preferences).some(value=>typeof value!=='boolean'))return res.status(400).json({error:'Preferensi notifikasi tidak valid.'});
  db.prepare("INSERT INTO user_preferences(user_id,tenant_id,preferences,updated_at) VALUES(?,'default',?,?) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences,updated_at=excluded.updated_at").run(req.user.id,JSON.stringify(preferences),now());
  audit(req.user.id,'account.preferences.updated','user',req.user.id,{fields:Object.keys(preferences)});res.json({message:'Preferensi tersimpan.'});
});

app.get('/api/admin/roles', requireAuth('admin'), requirePermission('admin.manage'), (_req,res) => {
  const roles = db.prepare('SELECT id,role_key AS key,display_name AS name FROM roles ORDER BY role_key').all();
  const permissions = db.prepare('SELECT id,permission_key AS key,description FROM permissions ORDER BY permission_key').all();
  const assigned = db.prepare('SELECT r.role_key,p.permission_key FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id').all();
  res.json({ roles: roles.map(role => ({ ...role, permissions: assigned.filter(row => row.role_key===role.key).map(row=>row.permission_key) })), permissions });
});
app.put('/api/admin/roles/:roleKey/permissions', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, (req,res) => {
  const role = db.prepare('SELECT id,role_key FROM roles WHERE role_key=?').get(req.params.roleKey);
  const keys = req.body?.permissions;
  if (!role || !Array.isArray(keys) || keys.length > 100 || keys.some(key => typeof key !== 'string')) return res.status(400).json({ error: 'Peran atau daftar permission tidak valid.' });
  if (role.role_key === 'admin' && !keys.includes('admin.manage')) return res.status(400).json({ error: 'Super Admin harus mempertahankan permission admin.manage.' });
  const unique = [...new Set(keys)];
  const known = db.prepare(`SELECT id FROM permissions WHERE permission_key IN (${unique.map(()=>'?').join(',') || "''"})`).all(...unique);
  if (known.length !== unique.length) return res.status(400).json({ error: 'Daftar berisi permission yang tidak dikenal.' });
  db.transaction(() => {
    db.prepare('DELETE FROM role_permissions WHERE role_id=?').run(role.id);
    const insert = db.prepare('INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)');
    for (const item of known) insert.run(role.id,item.id);
    audit(req.user.id,'rbac.role_permissions.updated','role',role.role_key,{permissions:unique});
  })();
  res.json({ role: role.role_key, permissions: unique });
});
app.get('/api/admin/users', requireAuth('admin'), requirePermission('admin.manage'), (_req,res) => {
  res.json(db.prepare(`SELECT u.id,u.name,u.email,u.status,u.created_at AS createdAt,r.role_key AS role,
    (SELECT group_concat(g.name,', ') FROM user_group_members gm JOIN user_groups g ON g.id=gm.group_id WHERE gm.user_id=u.id) AS groups,
    (SELECT gm.group_id FROM user_group_members gm WHERE gm.user_id=u.id ORDER BY gm.added_at LIMIT 1) AS groupId
    FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id AND ur.tenant_id='default' LEFT JOIN roles r ON r.id=ur.role_id ORDER BY u.created_at DESC`).all());
});
app.post('/api/admin/users', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, asyncRoute(async (req,res) => {
  const name=String(req.body?.name||'').trim(), email=String(req.body?.email||'').trim().toLowerCase(), password=String(req.body?.password||''), roleKey=String(req.body?.role||''), groupId=req.body?.groupId||null;
  const role=db.prepare('SELECT id,role_key FROM roles WHERE role_key=?').get(roleKey);
  if (!name || name.length>120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || password.length<12 || password.length>128 || !role) return res.status(400).json({error:'Nama, email, kata sandi minimal 12 karakter, dan role valid wajib diisi.'});
  if (groupId && !db.prepare("SELECT 1 FROM user_groups WHERE id=? AND tenant_id='default'").get(groupId)) return res.status(400).json({error:'Grup tidak ditemukan.'});
  const userId=id('USR'); const passwordHash=await hashPassword(password);
  try { db.transaction(()=>{
    const legacyRole=roleKey==='student'?'student':roleKey==='guru'?'tutor':'admin';
    db.prepare('INSERT INTO users(id,name,email,password_hash,role,status,created_at) VALUES(?,?,?,?,?,?,?)').run(userId,name,email,passwordHash,legacyRole,'active',now());
    db.prepare('INSERT INTO user_roles(user_id,role_id,tenant_id,assigned_at,assigned_by) VALUES(?,?,?,?,?)').run(userId,role.id,'default',now(),req.user.id);
    if(roleKey==='student'){db.prepare('INSERT OR IGNORE INTO subscriptions(user_id,remaining,total) VALUES(?,0,0)').run(userId);db.prepare('INSERT OR IGNORE INTO student_profiles(user_id,tenant_id) VALUES(?,\'default\')').run(userId);}
    if(roleKey==='guru'){db.prepare('INSERT OR IGNORE INTO tutor_wallets(user_id,available) VALUES(?,0)').run(userId);db.prepare("INSERT OR IGNORE INTO tutor_details(user_id,tenant_id,verification_status) VALUES(?,'default','pending')").run(userId);db.prepare("INSERT OR IGNORE INTO tutor_profiles(user_id,updated_at) VALUES(?,?)").run(userId,now());}
    if (groupId) db.prepare('INSERT INTO user_group_members(user_id,group_id,added_at) VALUES(?,?,?)').run(userId,groupId,now());
    audit(req.user.id,'user.created','user',userId,{role:roleKey,groupId});
  })(); } catch(error) { if(error.code==='SQLITE_CONSTRAINT_UNIQUE')return res.status(409).json({error:'Email sudah digunakan.'}); throw error; }
  res.status(201).json({id:userId,name,email,role:roleKey,status:'active'});
}));
app.patch('/api/admin/users/:id', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, (req,res) => {
  const target=db.prepare('SELECT id,role,status FROM users WHERE id=?').get(req.params.id);
  if(!target)return res.status(404).json({error:'Pengguna tidak ditemukan.'});
  const roleKey=req.body?.role; const status=req.body?.status; const groupId=req.body?.groupId;
  const role=roleKey ? db.prepare('SELECT id,role_key FROM roles WHERE role_key=?').get(roleKey) : null;
  if(roleKey&&!role)return res.status(400).json({error:'Role tidak dikenal.'});
  if(status&&!['active','inactive'].includes(status))return res.status(400).json({error:'Status akun tidak valid.'});
  if(groupId && !db.prepare("SELECT 1 FROM user_groups WHERE id=? AND tenant_id='default'").get(groupId))return res.status(400).json({error:'Grup tidak ditemukan.'});
  const currentRole=db.prepare('SELECT r.role_key FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND ur.tenant_id=\'default\'').get(target.id)?.role_key;
  if(currentRole==='admin'&&(roleKey&&roleKey!=='admin'||status==='inactive')&&db.prepare("SELECT count(*) AS count FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE r.role_key='admin' AND u.status='active'").get().count<=1)return res.status(409).json({error:'Sistem harus tetap memiliki minimal satu Super Admin aktif.'});
  db.transaction(()=>{
    if(role){
      db.prepare('DELETE FROM user_roles WHERE user_id=? AND tenant_id=\'default\'').run(target.id);
      db.prepare('INSERT INTO user_roles(user_id,role_id,tenant_id,assigned_at,assigned_by) VALUES(?,?,?,?,?)').run(target.id,role.id,'default',now(),req.user.id);
      const legacy=roleKey==='student'?'student':roleKey==='guru'?'tutor':'admin';
      db.prepare('UPDATE users SET role=? WHERE id=?').run(legacy,target.id);
      if(roleKey==='student'){db.prepare('INSERT OR IGNORE INTO subscriptions(user_id,remaining,total) VALUES(?,0,0)').run(target.id);db.prepare('INSERT OR IGNORE INTO student_profiles(user_id,tenant_id) VALUES(?,\'default\')').run(target.id);}
      if(roleKey==='guru'){db.prepare('INSERT OR IGNORE INTO tutor_wallets(user_id,available) VALUES(?,0)').run(target.id);db.prepare("INSERT OR IGNORE INTO tutor_details(user_id,tenant_id) VALUES(?,'default')").run(target.id);db.prepare("INSERT OR IGNORE INTO tutor_profiles(user_id,updated_at) VALUES(?,?)").run(target.id,now());}
    }
    if(status) db.prepare('UPDATE users SET status=? WHERE id=?').run(status,target.id);
    if(groupId!==undefined){db.prepare('DELETE FROM user_group_members WHERE user_id=?').run(target.id); if(groupId)db.prepare('INSERT INTO user_group_members(user_id,group_id,added_at) VALUES(?,?,?)').run(target.id,groupId,now());}
    audit(req.user.id,'user.updated','user',target.id,{role:roleKey||undefined,status:status||undefined,groupId:groupId||null});
  })();
  if(status==='inactive'||roleKey) db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  res.json({id:target.id,role:roleKey||undefined,status:status||target.status});
});
app.delete('/api/admin/users/:id',requireAuth('admin'),requirePermission('admin.manage'),requireCsrf,(req,res)=>{
  if(req.params.id===req.user.id)return res.status(400).json({error:'Admin tidak dapat menonaktifkan akunnya sendiri.'});
  const target=db.prepare('SELECT id,status FROM users WHERE id=?').get(req.params.id);if(!target)return res.status(404).json({error:'Pengguna tidak ditemukan.'});
  const role=db.prepare("SELECT r.role_key FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND ur.tenant_id='default'").get(target.id)?.role_key;
  if(role==='admin'&&target.status==='active'&&db.prepare("SELECT count(*) AS count FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE r.role_key='admin' AND u.status='active'").get().count<=1)return res.status(409).json({error:'Sistem harus tetap memiliki minimal satu Super Admin aktif.'});
  db.prepare("UPDATE users SET status='inactive' WHERE id=?").run(target.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);audit(req.user.id,'user.deactivated','user',target.id);res.json({id:target.id,status:'inactive'});
});
app.get('/api/admin/groups', requireAuth('admin'), requirePermission('admin.manage'), (_req,res)=>res.json(db.prepare("SELECT id,name,description FROM user_groups WHERE tenant_id='default' ORDER BY name").all()));
app.post('/api/admin/groups', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, (req,res)=>{
  const name=String(req.body?.name||'').trim(),description=String(req.body?.description||'').trim();
  if(!name||name.length>100||description.length>500)return res.status(400).json({error:'Nama grup wajib diisi (maks. 100 karakter), deskripsi maksimal 500.'});
  const groupId=id('GRP');
  try{db.prepare('INSERT INTO user_groups(id,tenant_id,name,description,created_at) VALUES(?,?,?,?,?)').run(groupId,'default',name,description,now());}
  catch(error){if(error.code==='SQLITE_CONSTRAINT_UNIQUE')return res.status(409).json({error:'Nama grup sudah digunakan.'});throw error;}
  audit(req.user.id,'user_group.created','user_group',groupId,{name});res.status(201).json({id:groupId,name,description});
});
app.get('/api/staff/context', requireAuth(), (req,res)=>{
  if(!['keuangan','marketing','front_office','back_office'].includes(req.user.role))return res.status(403).json({error:'Dashboard ini hanya untuk role staf.'});
  const permissions=db.prepare(`SELECT p.permission_key FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND ur.tenant_id='default'`).all(req.user.id).map(row=>row.permission_key);
  const metrics={};
  if(permissions.includes('transaction.manage')) metrics.transactions=db.prepare('SELECT count(*) AS count,coalesce(sum(amount),0) AS total FROM transactions').get();
  if(permissions.includes('enrollment.report')) metrics.registrations=db.prepare("SELECT count(*) AS count FROM users WHERE created_at >= date('now','-30 days')").get().count;
  if(permissions.includes('people.manage')) metrics.people=db.prepare("SELECT count(*) AS count FROM users WHERE status='active'").get().count;
  if(permissions.includes('attendance.manage')) metrics.pendingAttendance=db.prepare("SELECT count(*) AS count FROM attendance WHERE status='pending_review'").get().count;
  res.json({user:{id:req.user.id,name:req.user.name,email:req.user.email,role:req.user.role},permissions,metrics});
});

app.post('/api/auth/logout', requireAuth(), requireCsrf, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.user.token_hash);
  audit(req.user.id, 'logout', 'session');
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'strict', path: '/' });
  res.status(204).end();
});

app.get('/api/public/packages', (_req,res)=>res.json(db.prepare("SELECT id AS recordId,package_key AS id,name,price,session_count AS sessions,duration_minutes AS durationMinutes FROM packages WHERE tenant_id='default' AND is_active=1 ORDER BY price").all()));
app.post('/api/packages',requireAuth(),requirePermission('package.manage'),requireCsrf,(req,res)=>{
  const name=String(req.body?.name||'').trim(),price=Number(req.body?.price),sessions=Number(req.body?.sessions),duration=Number(req.body?.durationMinutes);
  const key=String(req.body?.key||name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).slice(0,40);
  if(!name||name.length>100||!key||!Number.isSafeInteger(price)||price<0||!Number.isInteger(sessions)||sessions<1||sessions>1000||!Number.isInteger(duration)||duration<15||duration>360)return res.status(400).json({error:'Nama, harga, jumlah sesi, dan durasi paket tidak valid.'});
  const packageId=id('PKG');
  try{db.prepare('INSERT INTO packages(id,tenant_id,name,package_key,price,session_count,duration_minutes) VALUES(?,?,?,?,?,?,?)').run(packageId,'default',name,key,price,sessions,duration);}
  catch(error){if(error.code==='SQLITE_CONSTRAINT_UNIQUE')return res.status(409).json({error:'Kunci paket sudah digunakan.'});throw error;}
  audit(req.user.id,'package.created','package',packageId,{name,price,sessions,duration});res.status(201).json({recordId:packageId,id:key,name,price,sessions,durationMinutes:duration});
});
app.put('/api/packages/:id',requireAuth(),requirePermission('package.manage'),requireCsrf,(req,res)=>{
  const name=String(req.body?.name||'').trim(),price=Number(req.body?.price),sessions=Number(req.body?.sessions),duration=Number(req.body?.durationMinutes),active=Boolean(req.body?.active);
  if(!name||name.length>100||!Number.isSafeInteger(price)||price<0||!Number.isInteger(sessions)||sessions<1||!Number.isInteger(duration)||duration<15)return res.status(400).json({error:'Data paket tidak valid.'});
  const result=db.prepare("UPDATE packages SET name=?,price=?,session_count=?,duration_minutes=?,is_active=? WHERE id=? AND tenant_id='default'").run(name,price,sessions,duration,active?1:0,req.params.id);
  if(!result.changes)return res.status(404).json({error:'Paket tidak ditemukan.'});audit(req.user.id,'package.updated','package',req.params.id,{name,price,sessions,duration,active});res.json({message:'Paket diperbarui.'});
});
app.get('/api/student/sessions', requireAuth('student'), requirePermission('student.dashboard'), (req,res)=>{
  res.json(db.prepare(`SELECT ls.id,ls.scheduled_at AS scheduledAt,ls.duration_minutes AS durationMinutes,ls.status,ls.is_free_trial AS freeTrial,s.name AS subject,t.name AS tutor,
    EXISTS(SELECT 1 FROM session_reviews sr WHERE sr.learning_session_id=ls.id AND sr.student_id=ls.student_id) AS reviewed
    FROM learning_sessions ls LEFT JOIN subjects s ON s.id=ls.subject_id LEFT JOIN users t ON t.id=ls.tutor_id WHERE ls.student_id=? ORDER BY ls.scheduled_at`).all(req.user.id));
});
function findAvailableTutor(subjectId, scheduledAt) {
  const starts=new Date(scheduledAt);const ends=new Date(starts.valueOf()+90*60*1000);
  const weekday=new Intl.DateTimeFormat('id-ID',{weekday:'long',timeZone:'Asia/Jakarta'}).format(starts);
  const day=weekday.charAt(0).toUpperCase()+weekday.slice(1);
  const clock=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Jakarta'}).format(starts);
  const startMinutes=Number(clock.slice(0,2))*60+Number(clock.slice(3));const endMinutes=startMinutes+90;
  const tutors=db.prepare(`SELECT u.id,u.name,tp.availability_json FROM users u JOIN tutor_details td ON td.user_id=u.id LEFT JOIN tutor_profiles tp ON tp.user_id=u.id
    WHERE u.role='tutor' AND u.status='active' AND td.verification_status='verified' ORDER BY u.created_at`).all();
  for(const tutor of tutors){
    let slots=[];try{slots=JSON.parse(tutor.availability_json||'[]')}catch{}
    const available=slots.some(slot=>{
      if(slot.day!==day)return false;
      const match=/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.exec(slot.time||'');if(!match)return false;
      const from=Number(match[1])*60+Number(match[2]),to=Number(match[3])*60+Number(match[4]);return startMinutes>=from&&endMinutes<=to;
    });
    if(!available)continue;
    const subjectCount=db.prepare('SELECT count(*) AS count FROM tutor_subjects WHERE tutor_id=?').get(tutor.id).count;
    if(subjectCount&&!db.prepare('SELECT 1 FROM tutor_subjects WHERE tutor_id=? AND subject_id=?').get(tutor.id,subjectId))continue;
    const collision=db.prepare(`SELECT 1 FROM learning_sessions WHERE tutor_id=? AND status IN ('scheduled','ongoing') AND julianday(scheduled_at)<julianday(?) AND julianday(scheduled_at,'+' || duration_minutes || ' minutes')>julianday(?) LIMIT 1`).get(tutor.id,ends.toISOString(),starts.toISOString());
    if(!collision)return tutor;
  }
  return null;
}
app.get('/api/student/bookings/match', requireAuth('student'), requirePermission('student.dashboard'), (req,res)=>{
  const subject=String(req.query.subject||'').trim();
  const subjectRow=db.prepare("SELECT id,name FROM subjects WHERE tenant_id='default' AND lower(name)=lower(?) AND is_active=1").get(subject);
  const scheduledAt=String(req.query.scheduledAt||'');if(!subjectRow||!Number.isFinite(Date.parse(scheduledAt)))return res.status(400).json({error:'Mata pelajaran atau waktu tidak valid.'});
  const tutor=findAvailableTutor(subjectRow.id,scheduledAt);
  if(!tutor)return res.status(404).json({error:'Tidak ada pengajar terverifikasi dengan slot waktu tersebut.'});
  res.json({tutor:{id:tutor.id,name:tutor.name,qualification:'Pengajar terverifikasi'}});
});
app.post('/api/student/bookings', requireAuth('student'), requirePermission('student.dashboard'), requireCsrf, (req,res)=>{
  const subjectName=String(req.body?.subject||'').trim(); const scheduledAt=String(req.body?.scheduledAt||''); const freeTrial=Boolean(req.body?.freeTrial);
  const date=new Date(scheduledAt); const subject=db.prepare("SELECT id,name FROM subjects WHERE tenant_id='default' AND lower(name)=lower(?) AND is_active=1").get(subjectName);
  if(!subject||!Number.isFinite(date.valueOf())||date<=new Date()||date.toISOString()!==scheduledAt||date.getMinutes()%15!==0)return res.status(400).json({error:'Mata pelajaran atau waktu booking tidak valid.'});
  const studentProfile=db.prepare('SELECT free_trial_available FROM student_profiles WHERE user_id=?').get(req.user.id);
  const subscription=db.prepare('SELECT remaining FROM subscriptions WHERE user_id=?').get(req.user.id)||{remaining:0};
  if(freeTrial&&!studentProfile?.free_trial_available)return res.status(409).json({error:'Hak free trial sudah digunakan.'});
  if(!freeTrial&&subscription.remaining<1)return res.status(409).json({error:'Kuota sesi tidak cukup. Beli paket terlebih dahulu.'});
  const tutor=findAvailableTutor(subject.id,scheduledAt);
  if(!tutor)return res.status(409).json({error:'Belum ada pengajar terverifikasi yang dapat menerima booking.'});
  const sessionId=id('SES');
  try { db.transaction(()=>{
    db.prepare('INSERT INTO learning_sessions(id,tenant_id,student_id,tutor_id,subject_id,scheduled_at,duration_minutes,status,is_free_trial) VALUES(?,?,?,?,?,?,90,\'scheduled\',?)').run(sessionId,'default',req.user.id,tutor.id,subject.id,scheduledAt,freeTrial?1:0);
    if(freeTrial) {
      const used=db.prepare('UPDATE student_profiles SET free_trial_available=0 WHERE user_id=? AND free_trial_available=1').run(req.user.id);
      if(!used.changes)throw Object.assign(new Error('Hak free trial sudah digunakan.'),{code:'TRIAL_USED'});
    } else {
      const reserved=db.prepare('UPDATE subscriptions SET remaining=remaining-1 WHERE user_id=? AND remaining>0').run(req.user.id);
      if(!reserved.changes)throw Object.assign(new Error('Kuota sesi tidak cukup. Beli paket terlebih dahulu.'),{code:'QUOTA_EMPTY'});
    }
    audit(req.user.id,'booking.created','learning_session',sessionId,{tutorId:tutor.id,subject:subject.name,freeTrial});
  })(); } catch(error) { if(['TRIAL_USED','QUOTA_EMPTY'].includes(error.code))return res.status(409).json({error:error.message}); throw error; }
  res.status(201).json({id:sessionId,tutor:tutor.name,subject:subject.name,scheduledAt,status:'scheduled',freeTrial});
});
app.get('/api/student/profile', requireAuth('student'), requirePermission('student.dashboard'), (req,res)=>res.json(db.prepare('SELECT grade,school,address,phone,free_trial_available AS freeTrialAvailable FROM student_profiles WHERE user_id=?').get(req.user.id)||{}));
app.put('/api/student/profile', requireAuth('student'), requirePermission('student.dashboard'), requireCsrf, (req,res)=>{
  const grade=String(req.body?.grade||'').trim(),school=String(req.body?.school||'').trim(),address=String(req.body?.address||'').trim(),phone=String(req.body?.phone||'').trim();
  if(grade.length>40||school.length>150||address.length>500||(phone&&!/^[+\d() -]{8,20}$/.test(phone)))return res.status(400).json({error:'Jenjang maksimal 40, sekolah 150, alamat 500 karakter; nomor telepon harus valid.'});
  db.prepare('INSERT INTO student_profiles(user_id,tenant_id,grade,school,address,phone) VALUES(?,\'default\',?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET grade=excluded.grade,school=excluded.school,address=excluded.address,phone=excluded.phone').run(req.user.id,grade,school,address,phone);
  audit(req.user.id,'student.profile.updated','student_profile',req.user.id,{grade,school});res.json({grade,school,address});
});
app.post('/api/student/sessions/:id/review', requireAuth('student'), requirePermission('student.dashboard'), requireCsrf,(req,res)=>{
  const rating=Number(req.body?.rating),comment=String(req.body?.comment||'').trim();
  const session=db.prepare("SELECT id FROM learning_sessions WHERE id=? AND student_id=? AND status='completed'").get(req.params.id,req.user.id);
  if(!session)return res.status(404).json({error:'Sesi selesai tidak ditemukan untuk akun Anda.'});
  if(!Number.isInteger(rating)||rating<1||rating>5||comment.length>1000)return res.status(400).json({error:'Rating harus 1–5 dan komentar maksimal 1.000 karakter.'});
  try{db.prepare('INSERT INTO session_reviews(id,tenant_id,learning_session_id,student_id,rating,comment,created_at) VALUES(?,?,?,?,?,?,?)').run(id('REV'),'default',session.id,req.user.id,rating,comment,now());}
  catch(error){if(error.code==='SQLITE_CONSTRAINT_UNIQUE')return res.status(409).json({error:'Ulasan untuk sesi ini sudah dikirim.'});throw error;}
  audit(req.user.id,'session.reviewed','learning_session',session.id,{rating});res.status(201).json({message:'Ulasan berhasil dikirim.'});
});
app.get('/api/tutor/sessions', requireAuth('tutor'), requirePermission('tutor.dashboard'), (req,res)=>res.json(db.prepare(`SELECT ls.id,ls.scheduled_at AS scheduledAt,ls.duration_minutes AS durationMinutes,ls.status,s.name AS subject,u.name AS student
  FROM learning_sessions ls JOIN users u ON u.id=ls.student_id LEFT JOIN subjects s ON s.id=ls.subject_id WHERE ls.tutor_id=? AND ls.status IN ('scheduled','ongoing') ORDER BY ls.scheduled_at`).all(req.user.id)));

app.get('/api/student/financial', requireAuth('student'), requirePermission('student.dashboard'), (req, res) => {
  const subscription = db.prepare('SELECT remaining,total FROM subscriptions WHERE user_id=?').get(req.user.id) || { remaining: 0, total: 0 };
  const transactions = db.prepare("SELECT id,description,amount,gateway,status,created_at AS date FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 100").all(req.user.id);
  res.json({ subscription, transactions });
});

function finalizeGatewayPayment(transaction, externalAmount) {
  if (externalAmount != null && Math.round(Number(externalAmount) * 100) !== transaction.amount * 100) throw new Error('Nominal callback tidak cocok.');
  const metadata = JSON.parse(transaction.metadata || '{}');
  if (transaction.status === 'paid') return;
  if (!metadata.packageId || !Number.isInteger(metadata.sessions)) throw new Error('Metadata pesanan tidak valid.');
  const ts = now();
  db.transaction(() => {
    const changed=db.prepare("UPDATE transactions SET status='paid',metadata=? WHERE id=? AND status!='paid'").run(JSON.stringify({ ...metadata, paidAt: ts }), transaction.id).changes;
    if(!changed)return;
    db.prepare('INSERT INTO subscriptions(user_id,remaining,total) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET remaining=remaining+excluded.remaining,total=total+excluded.total').run(transaction.user_id, metadata.sessions, metadata.sessions);
    db.prepare('INSERT INTO learning_subscriptions(id,tenant_id,student_id,package_id,remaining,total,starts_at,status) VALUES(?,?,?,?,?,?,?,\'active\')').run(id('SUB'),'default',transaction.user_id,metadata.packageRecordId,metadata.sessions,metadata.sessions,ts);
    audit(null,'payment.gateway_paid','transaction',transaction.id,{gateway:transaction.gateway,amount:transaction.amount});
  })();
}

app.post('/api/payments/create', requireAuth('student'), requirePermission('student.dashboard'), requireCsrf, asyncRoute(async (req,res)=>{
  const payment=paymentSettings(); const provider=['midtrans','xendit'].includes(payment.provider)?payment.provider:null;
  if(payment.mode==='simulator')return res.status(503).json({error:'Mode simulator tidak membuat checkout provider.'});
  const secret=provider&&providerSecret(payment,provider,provider==='midtrans'?'serverKey':'secretKey');
  const callbackToken=provider==='xendit'&&providerSecret(payment,provider,'webhookVerificationToken');
  const webhookReady=typeof payment.webhookReady==='object'?Boolean(payment.webhookReady[provider]):Boolean(payment.webhookReady);
  if(!provider||!secret||!webhookReady||(provider==='xendit'&&!callbackToken))return res.status(503).json({error:'Payment gateway belum siap. Lengkapi secret key dan pasang webhook provider di Pengaturan Sistem.'});
  const pkg=db.prepare("SELECT id,package_key AS packageId,name,price,session_count AS sessions,duration_minutes AS durationMinutes FROM packages WHERE tenant_id='default' AND is_active=1 AND package_key=?").get(String(req.body?.packageId||''));
  const key=String(req.get('idempotency-key')||'');
  if(!pkg||! /^[A-Za-z0-9_-]{16,100}$/.test(key))return res.status(400).json({error:'Paket atau kunci permintaan tidak valid.'});
  const existing=db.prepare('SELECT id,user_id,gateway,status,metadata FROM transactions WHERE idempotency_key=? AND user_id=?').get(key,req.user.id);
  if(existing){const meta=JSON.parse(existing.metadata||'{}');if(existing.status==='pending'&&meta.checkoutUrl)return res.json({orderId:existing.id,checkoutUrl:meta.checkoutUrl,duplicate:true});return res.status(409).json({error:'Permintaan pembayaran ini sudah diproses.',status:existing.status});}
  const orderId=id('PAY'); const ts=now(); const publicBase=process.env.TREVY_PUBLIC_URL||`${req.protocol}://${req.get('host')}`;
  if((IS_PRODUCTION||provider==='xendit')&&(!process.env.TREVY_PUBLIC_URL||!/^https:\/\//i.test(publicBase)))return res.status(503).json({error:'Atur TREVY_PUBLIC_URL ke alamat HTTPS publik sebelum mengaktifkan checkout.'});
  const base=publicBase.replace(/\/$/,'');
  const metadata={packageId:pkg.packageId,packageRecordId:pkg.id,sessions:pkg.sessions};
  db.prepare('INSERT INTO transactions(id,user_id,kind,description,amount,gateway,status,metadata,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(orderId,req.user.id,'payment_gateway',`${pkg.name} (${pkg.sessions} sesi)`,pkg.price,provider,'pending',JSON.stringify(metadata),key,ts);
  try {
    let checkoutUrl;
    if(provider==='midtrans'){
      const production=['production','live'].includes(payment.mode);
      const endpoint=production?'https://app.midtrans.com/snap/v1/transactions':'https://app.sandbox.midtrans.com/snap/v1/transactions';
      const response=await fetch(endpoint,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json','Authorization':`Basic ${Buffer.from(`${secret}:`).toString('base64')}`},body:JSON.stringify({transaction_details:{order_id:orderId,gross_amount:pkg.price},item_details:[{id:pkg.packageId,price:pkg.price,quantity:1,name:pkg.name.slice(0,50)}],customer_details:{first_name:req.user.name,email:req.user.email},callbacks:{finish:`${base}/dashboard-student.html?payment_order=${encodeURIComponent(orderId)}`}})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok||!body.redirect_url)throw new Error('Midtrans menolak pembuatan transaksi. Periksa server key dan mode provider.');
      checkoutUrl=body.redirect_url;
    } else {
      const names=String(req.user.name||'Student').replace(/[^A-Za-z0-9 ]/g,' ').trim().split(/\s+/);
      const response=await fetch('https://api.xendit.co/sessions',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json','Authorization':`Basic ${Buffer.from(`${secret}:`).toString('base64')}`,'Idempotency-key':orderId},body:JSON.stringify({reference_id:orderId,session_type:'PAY',mode:'PAYMENT_LINK',amount:pkg.price,currency:'IDR',country:'ID',locale:'id',customer:{type:'INDIVIDUAL',email:req.user.email,individual_detail:{given_names:names[0]||'Student',surname:names.slice(1).join(' ')||'Student'}},description:`${pkg.name} (${pkg.sessions} sesi)`,success_return_url:`${base}/dashboard-student.html?payment_order=${encodeURIComponent(orderId)}`,cancel_return_url:`${base}/dashboard-student.html?payment_order=${encodeURIComponent(orderId)}`})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok||!body.payment_link_url)throw new Error('Xendit menolak pembuatan payment session. Periksa secret key dan mode provider.');
      checkoutUrl=body.payment_link_url;
    }
    db.prepare('UPDATE transactions SET metadata=? WHERE id=?').run(JSON.stringify({...metadata,checkoutUrl}),orderId);
    res.status(201).json({orderId,checkoutUrl,provider});
  } catch(error) {
    db.prepare("UPDATE transactions SET status='failed',metadata=? WHERE id=? AND status='pending'").run(JSON.stringify({...metadata,providerError:error.message}),orderId);
    throw error;
  }
}));

app.get('/api/payments/:id',requireAuth('student'),requirePermission('student.dashboard'),(req,res)=>{
  const transaction=db.prepare('SELECT id,status,amount,gateway,description,created_at AS date FROM transactions WHERE id=? AND user_id=? AND kind=\'payment_gateway\'').get(req.params.id,req.user.id);
  if(!transaction)return res.sendStatus(404);
  res.json({transaction});
});

app.post('/api/payments/webhooks/midtrans',(req,res)=>{
  const payment=paymentSettings();const serverKey=providerSecret(payment,'midtrans','serverKey');const body=req.body||{};
  if(!serverKey)return res.sendStatus(503);
  const expected=crypto.createHash('sha512').update(`${body.order_id||''}${body.status_code||''}${body.gross_amount||''}${serverKey}`).digest('hex');
  if(!constantTimeEqual(expected,body.signature_key))return res.sendStatus(401);
  const tx=db.prepare("SELECT id,user_id,gateway,status,amount,metadata FROM transactions WHERE id=? AND kind='payment_gateway'").get(String(body.order_id||''));
  if(!tx||tx.gateway!=='midtrans')return res.sendStatus(404);
  const status=String(body.transaction_status||'');
  try {
    if(status==='settlement'||status==='capture'&&body.fraud_status==='accept')finalizeGatewayPayment(tx,body.gross_amount);
    else if(['deny','cancel','expire'].includes(status)&&tx.status!=='paid')db.prepare("UPDATE transactions SET status='failed' WHERE id=? AND status='pending'").run(tx.id);
  } catch(error){return res.status(400).json({error:error.message});}
  res.sendStatus(200);
});

app.post('/api/payments/webhooks/xendit',(req,res)=>{
  const payment=paymentSettings();const token=providerSecret(payment,'xendit','webhookVerificationToken');
  if(!token||!constantTimeEqual(token,req.get('x-callback-token')))return res.sendStatus(401);
  const body=req.body||{};const data=body.data||{};const tx=db.prepare("SELECT id,user_id,gateway,status,amount,metadata FROM transactions WHERE id=? AND kind='payment_gateway'").get(String(data.reference_id||''));
  if(!tx||tx.gateway!=='xendit')return res.sendStatus(404);
  try {
    if(body.event==='payment_session.completed'&&data.status==='COMPLETED')finalizeGatewayPayment(tx,data.amount);
    else if(body.event==='payment_session.expired'&&data.status==='EXPIRED'&&tx.status!=='paid')db.prepare("UPDATE transactions SET status='failed' WHERE id=? AND status='pending'").run(tx.id);
  } catch(error){return res.status(400).json({error:error.message});}
  res.sendStatus(200);
});

/* ── Midtrans Snap & BI-SNAP Local Sandbox Bridge API ── */

app.post('/api/payments/bisnap/notify', (req, res) => {
  const payment = paymentSettings();
  const pubKey = payment.biSnapNotificationPublicKey;
  const timestamp = req.get('x-timestamp') || '';
  const signature = req.get('x-signature') || '';
  const partnerId = req.get('x-partner-id') || '';
  const channelId = req.get('channel-id') || '';
  const bodyStr = JSON.stringify(req.body || {});

  if (pubKey && signature) {
    try {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${req.method}:${req.originalUrl || req.url}:${bodyStr}:${timestamp}`);
      const valid = verifier.verify(pubKey, signature, 'base64');
      if (!valid && payment.mode === 'production') {
        return res.status(401).json({ responseCode: '4010000', responseMessage: 'Unauthorized. Signature not match' });
      }
    } catch (_e) {
      if (payment.mode === 'production') {
        return res.status(401).json({ responseCode: '4010000', responseMessage: 'Invalid signature format' });
      }
    }
  }

  audit(null, 'payment.bisnap_notification', 'bisnap', partnerId || 'unknown', {
    channelId,
    timestamp,
    body: req.body
  });

  res.status(200).json({
    responseCode: '2000000',
    responseMessage: 'Successful',
    referenceNo: req.body?.referenceNo || req.body?.partnerReferenceNo || null
  });
});

app.post('/api/admin/payments/bridge/midtrans-verify', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, asyncRoute(async (_req, res) => {
  const payment = paymentSettings();
  const serverKey = providerSecret(payment, 'midtrans', 'serverKey');
  if (!serverKey) {
    return res.status(400).json({ valid: false, error: 'Server Key Midtrans belum disimpan.' });
  }

  try {
    const response = await fetch('https://api.sandbox.midtrans.com/v2/TREVY-PING-CHECK/status', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`
      }
    });

    if (response.status === 401) {
      return res.status(401).json({
        valid: false,
        error: 'Midtrans Sandbox menolak Server Key (401 Unauthorized). Pastikan Server Key diawali "SB-Mid-server-".'
      });
    }

    return res.json({
      valid: true,
      message: 'Koneksi ke Midtrans Sandbox berhasil! Server Key valid dan terautentikasi.',
      mode: payment.mode || 'sandbox',
      merchantId: payment.merchantId || null
    });
  } catch (err) {
    return res.status(502).json({
      valid: false,
      error: `Gagal menghubungi server Midtrans Sandbox: ${err.message}`
    });
  }
}));

app.post('/api/admin/payments/bridge/midtrans-simulate-webhook', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, (req, res) => {
  const { orderId, transactionStatus } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'Order ID wajib diisi.' });

  const tx = db.prepare("SELECT id,user_id,gateway,status,amount,metadata FROM transactions WHERE id=? AND kind='payment_gateway'").get(String(orderId));
  if (!tx) return res.status(404).json({ error: `Transaksi ${orderId} tidak ditemukan.` });

  const status = transactionStatus || 'settlement';
  try {
    if (status === 'settlement') {
      finalizeGatewayPayment(tx, tx.amount);
      return res.json({
        success: true,
        message: `Transaksi ${tx.id} berhasil diselesaikan (settlement). Sesi belajar telah dialokasikan ke pengguna.`,
        status: 'paid'
      });
    } else if (['deny', 'cancel', 'expire'].includes(status)) {
      db.prepare("UPDATE transactions SET status='failed' WHERE id=? AND status='pending'").run(tx.id);
      return res.json({
        success: true,
        message: `Transaksi ${tx.id} ditandai sebagai ${status}.`,
        status: 'failed'
      });
    }
    return res.status(400).json({ error: 'Status simulasi tidak valid.' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/payments/bridge/bisnap-verify', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, asyncRoute(async (_req, res) => {
  const payment = paymentSettings();
  const clientId = payment.biSnapClientId;
  const partnerId = payment.biSnapPartnerId;
  const channelId = payment.biSnapChannelId;
  const privKey = providerSecret(payment, 'midtrans', 'biSnapPrivateKey');
  const clientSecret = providerSecret(payment, 'midtrans', 'biSnapClientSecret');
  const merchantPubKey = payment.biSnapMerchantPublicKey;
  const notifPubKey = payment.biSnapNotificationPublicKey;

  const checks = {
    metadata: {
      hasClientId: Boolean(clientId),
      hasPartnerId: Boolean(partnerId),
      hasChannelId: Boolean(channelId && /^\d{5}$/.test(channelId)),
      hasClientSecret: Boolean(clientSecret)
    },
    keys: {
      privateKeyParsed: false,
      merchantPublicKeyParsed: false,
      notificationPublicKeyParsed: false,
      rsaKeyPairMatches: false
    },
    sandboxB2BToken: {
      tested: false,
      success: false,
      responseCode: null,
      message: null
    }
  };

  if (privKey) {
    try {
      crypto.createPrivateKey(privKey);
      checks.keys.privateKeyParsed = true;
    } catch (e) {
      checks.keys.privateKeyError = e.message;
    }
  }

  if (merchantPubKey) {
    try {
      crypto.createPublicKey(merchantPubKey);
      checks.keys.merchantPublicKeyParsed = true;
    } catch (e) {
      checks.keys.merchantPublicKeyError = e.message;
    }
  }

  if (notifPubKey) {
    try {
      crypto.createPublicKey(notifPubKey);
      checks.keys.notificationPublicKeyParsed = true;
    } catch (e) {
      checks.keys.notificationPublicKeyError = e.message;
    }
  }

  if (checks.keys.privateKeyParsed && checks.keys.merchantPublicKeyParsed) {
    try {
      const testData = Buffer.from('trevy-bisnap-crypto-test-' + Date.now());
      const signature = crypto.sign('sha256', testData, privKey);
      checks.keys.rsaKeyPairMatches = crypto.verify('sha256', testData, merchantPubKey, signature);
    } catch (e) {
      checks.keys.rsaMatchError = e.message;
    }
  }

  if (clientId && checks.keys.privateKeyParsed) {
    checks.sandboxB2BToken.tested = true;
    try {
      const timestamp = new Date().toISOString();
      const stringToSign = `${clientId}|${timestamp}`;
      const signature = crypto.sign('sha256', Buffer.from(stringToSign), privKey).toString('base64');

      const response = await fetch('https://merchants.sbx.midtrans.com/v1.0/access-token/b2b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TIMESTAMP': timestamp,
          'X-CLIENT-KEY': clientId,
          'X-SIGNATURE': signature
        },
        body: JSON.stringify({ grantType: 'client_credentials', additionalInfo: {} }),
        signal: AbortSignal.timeout(6000)
      });

      const data = await response.json().catch(() => ({}));
      checks.sandboxB2BToken.responseCode = data.responseCode || response.status;
      checks.sandboxB2BToken.responseMessage = data.responseMessage || response.statusText;

      if (data.responseCode === '2007300') {
        checks.sandboxB2BToken.success = true;
        checks.sandboxB2BToken.message = 'B2B Token exchange berhasil! Kredensial terverifikasi oleh Midtrans Sandbox.';
      } else {
        checks.sandboxB2BToken.message = data.responseMessage || `Response ${response.status}: ${JSON.stringify(data)}`;
      }
    } catch (e) {
      checks.sandboxB2BToken.message = `Gagal menghubungi Midtrans Sandbox B2B endpoint: ${e.message}`;
    }
  }

  res.json({
    status: checks.keys.rsaKeyPairMatches ? 'ready' : 'incomplete',
    checks
  });
}));

app.get('/api/admin/payments/bridge/pending-orders', requireAuth('admin'), requirePermission('admin.manage'), (_req, res) => {
  const orders = db.prepare("SELECT id, amount, description, gateway, created_at AS date FROM transactions WHERE kind='payment_gateway' AND status='pending' ORDER BY created_at DESC LIMIT 20").all();
  res.json({ orders });
});

app.post('/api/payments/simulate', requireAuth('student'), requirePermission('student.dashboard'), requireCsrf, (req, res) => {
  if (IS_PRODUCTION) return res.status(403).json({ error: 'Simulator pembayaran dimatikan di production.' });
  const pkg = db.prepare("SELECT id,package_key AS packageId,name,price,session_count AS sessions,duration_minutes AS durationMinutes FROM packages WHERE tenant_id='default' AND is_active=1 AND package_key=?").get(String(req.body?.packageId || ''));
  const gateway = ['midtrans', 'xendit'].includes(req.body?.gateway) ? req.body.gateway : null;
  const key = String(req.get('idempotency-key') || '');
  if (!pkg || !gateway || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) return res.status(400).json({ error: 'Paket, provider, atau kunci permintaan tidak valid.' });
  const existing = db.prepare('SELECT id,description,amount,gateway,status,created_at AS date FROM transactions WHERE idempotency_key=? AND user_id=?').get(key, req.user.id);
  if (existing) return res.json({ transaction: existing, duplicate: true });
  const txId = id('PAY'); const ts = now();
  try {
    db.transaction(() => {
      db.prepare('INSERT INTO subscriptions(user_id,remaining,total) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET remaining=remaining+excluded.remaining,total=total+excluded.total').run(req.user.id, pkg.sessions, pkg.sessions);
      const subscriptionId=id('SUB'); const startedAt=new Date().toISOString();
      db.prepare('INSERT INTO learning_subscriptions(id,tenant_id,student_id,package_id,remaining,total,starts_at,status) VALUES(?,?,?,?,?,?,?,?)').run(subscriptionId,'default',req.user.id,pkg.id,pkg.sessions,pkg.sessions,startedAt,'active');
      db.prepare('INSERT INTO transactions(id,user_id,kind,description,amount,gateway,status,metadata,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(txId, req.user.id, 'payment_simulation', `${pkg.name} (${pkg.sessions} sesi)`, pkg.price, gateway, 'simulated_success', JSON.stringify({ packageId: pkg.packageId, sessions: pkg.sessions }), key, ts);
      audit(req.user.id, 'payment.simulated', 'transaction', txId, { packageId: pkg.packageId, gateway, amount: pkg.price });
    })();
  } catch (error) { if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Permintaan ini sudah diproses.' }); throw error; }
  res.status(201).json({ transaction: { id: txId, description: `${pkg.name} (${pkg.sessions} sesi)`, amount: pkg.price, gateway, status: 'simulated_success', date: ts }, subscription: db.prepare('SELECT remaining,total FROM subscriptions WHERE user_id=?').get(req.user.id) });
});

app.get('/api/tutor/financial', requireAuth('tutor'), requirePermission('tutor.dashboard'), (req, res) => {
  const wallet = db.prepare('SELECT available FROM tutor_wallets WHERE user_id=?').get(req.user.id) || { available: 0 };
  const attendance = db.prepare('SELECT id,student_name AS student,subject,topic,status,honor,created_at AS date FROM attendance WHERE tutor_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  const withdrawals = db.prepare('SELECT id,bank,account,amount,status,created_at AS date FROM withdrawals WHERE tutor_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  const profile = db.prepare('SELECT bank_code AS bank,account_number AS accountNumber,account_name AS accountName,phone,availability_json AS availabilityJson FROM tutor_profiles WHERE user_id=?').get(req.user.id) || { bank: '', accountNumber: '', accountName: '', phone: '', availabilityJson: '[]' };
  profile.availability = JSON.parse(profile.availabilityJson || '[]'); delete profile.availabilityJson;
  const activeSession = db.prepare('SELECT student_name AS student,subject,started_at AS startedAt FROM tutor_active_sessions WHERE tutor_id=?').get(req.user.id) || null;
  res.json({ wallet, attendance, withdrawals, profile, activeSession });
});

app.put('/api/tutor/availability', requireAuth('tutor'), requirePermission('tutor.dashboard'), requireCsrf, (req, res) => {
  const slots = req.body?.slots;
  const validSlots = { Senin: new Set(['08:00 - 12:00','14:00 - 17:00']), Selasa: new Set(['09:00 - 12:00','15:00 - 19:00']), Sabtu: new Set(['08:00 - 16:00']) };
  if (!Array.isArray(slots) || slots.length > 5 || slots.some(slot => !validSlots[slot?.day]?.has(slot?.time))) return res.status(400).json({ error: 'Slot ketersediaan tidak valid.' });
  const unique = [...new Map(slots.map(slot => [`${slot.day}|${slot.time}`, { day: slot.day, time: slot.time }])).values()];
  db.transaction(()=>{
    db.prepare(`INSERT INTO tutor_profiles(user_id,availability_json,updated_at) VALUES(?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET availability_json=excluded.availability_json,updated_at=excluded.updated_at`)
      .run(req.user.id, JSON.stringify(unique), now());
    db.prepare('DELETE FROM tutor_availability WHERE tutor_id=?').run(req.user.id);
    const dayNumbers={Minggu:0,Senin:1,Selasa:2,Rabu:3,Kamis:4,Jumat:5,Sabtu:6};
    const insert=db.prepare("INSERT INTO tutor_availability(id,tenant_id,tutor_id,weekday,starts_at,ends_at) VALUES(?,'default',?,?,?,?)");
    for(const slot of unique){const [start,end]=slot.time.split(' - ');insert.run(id('AVL'),req.user.id,dayNumbers[slot.day],start,end);}
  })();
  audit(req.user.id, 'tutor.availability.updated', 'tutor_profile', req.user.id, { slotCount: unique.length });
  res.json({ slots: unique });
});

app.put('/api/tutor/profile', requireAuth('tutor'), requirePermission('tutor.dashboard'), requireCsrf, (req, res) => {
  const bank = String(req.body?.bank || '').trim().toUpperCase();
  const accountNumber = String(req.body?.accountNumber || '').replace(/\s/g, '');
  const accountName = String(req.body?.accountName || '').trim().replace(/\s+/g, ' ');
  const phone = String(req.body?.phone || '').trim();
  const banks = new Set(['BCA','BNI','BRI','MANDIRI','BSI','CIMB','PERMATA','DANAMON','BTN','JAGO']);
  if (!banks.has(bank) || !/^\d{6,20}$/.test(accountNumber) || accountName.length < 2 || accountName.length > 100 || (phone && !/^[+\d() -]{8,20}$/.test(phone))) return res.status(400).json({ error: 'Bank, nomor rekening, nama pemilik, atau nomor WhatsApp tidak valid.' });
  db.prepare(`INSERT INTO tutor_profiles(user_id,bank_code,account_number,account_name,phone,updated_at) VALUES(?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET bank_code=excluded.bank_code,account_number=excluded.account_number,account_name=excluded.account_name,phone=excluded.phone,updated_at=excluded.updated_at`)
    .run(req.user.id, bank, accountNumber, accountName, phone, now());
  audit(req.user.id, 'tutor.profile.updated', 'tutor_profile', req.user.id, { bank, accountNumberLast4: accountNumber.slice(-4) });
  res.json({ bank, accountNumber, accountName, phone });
});

app.put('/api/account/password', requireAuth(), requireCsrf, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 12 || newPassword.length > 128) return res.status(400).json({ error: 'Kata sandi baru harus terdiri dari 12–128 karakter.' });
  const stored = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
  if (!await verifyPassword(currentPassword, stored.password_hash)) return res.status(401).json({ error: 'Kata sandi saat ini tidak sesuai.' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await hashPassword(newPassword), req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(req.user.id, req.user.token_hash);
  audit(req.user.id, 'account.password_changed', 'user', req.user.id);
  res.json({ message: 'Kata sandi berhasil diubah.' });
});

app.post('/api/tutor/checkin', requireAuth('tutor'), requirePermission('tutor.dashboard'), requireCsrf, (req, res) => {
  if (db.prepare('SELECT 1 FROM tutor_active_sessions WHERE tutor_id=?').get(req.user.id)) return res.status(409).json({ error: 'Sesi masih berlangsung. Selesaikan check-out terlebih dahulu.' });
  let lesson = req.body?.sessionId ? db.prepare("SELECT ls.*,u.name AS student,s.name AS subject FROM learning_sessions ls JOIN users u ON u.id=ls.student_id LEFT JOIN subjects s ON s.id=ls.subject_id WHERE ls.id=? AND ls.tutor_id=? AND ls.status='scheduled'").get(String(req.body.sessionId),req.user.id) : db.prepare("SELECT ls.*,u.name AS student,s.name AS subject FROM learning_sessions ls JOIN users u ON u.id=ls.student_id LEFT JOIN subjects s ON s.id=ls.subject_id WHERE ls.tutor_id=? AND ls.status='scheduled' ORDER BY ls.scheduled_at LIMIT 1").get(req.user.id);
  if (req.body?.sessionId && !lesson) return res.status(404).json({ error: 'Jadwal tidak ditemukan atau bukan milik Anda.' });
  const student = lesson?.student || 'Sesi manual (tanpa booking)'; const subject = lesson?.subject || 'Sesi manual';
  const latitude = Number(req.body?.latitude); const longitude = Number(req.body?.longitude);
  db.transaction(()=>{
    db.prepare('INSERT INTO tutor_active_sessions(tutor_id,student_name,subject,started_at,latitude,longitude,student_id,learning_session_id) VALUES(?,?,?,?,?,?,?,?)')
      .run(req.user.id, student, subject, now(), Number.isFinite(latitude) ? latitude : null, Number.isFinite(longitude) ? longitude : null,lesson?.student_id||null,lesson?.id||null);
    if(lesson) db.prepare("UPDATE learning_sessions SET status='ongoing',checkin_at=? WHERE id=? AND status='scheduled'").run(now(),lesson.id);
  })();
  audit(req.user.id, 'attendance.checkin', 'tutor_session', req.user.id, { locationProvided: Number.isFinite(latitude) && Number.isFinite(longitude) });
  res.status(201).json({ status: 'in_progress' });
});

app.post('/api/tutor/checkout', requireAuth('tutor'), requirePermission('tutor.dashboard'), requireCsrf, (req, res) => {
  const topic = String(req.body?.topic || '').trim().slice(0, 200);
  if (!topic) return res.status(400).json({ error: 'Materi yang diajarkan wajib diisi.' });
  const result = db.transaction(() => {
    const active = db.prepare('SELECT * FROM tutor_active_sessions WHERE tutor_id=?').get(req.user.id);
    if (!active) throw Object.assign(new Error('Tidak ada sesi aktif. Mulai check-in terlebih dahulu.'), { code: 'NO_ACTIVE_SESSION' });
    const attendanceId = id('ATT'); const ts = now();
    db.prepare('INSERT INTO attendance(id,tutor_id,student_name,subject,topic,status,honor,created_at,checkin_latitude,checkin_longitude,student_id,learning_session_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(attendanceId, req.user.id, active.student_name, active.subject, topic, 'pending_review', standardSessionRate(), ts, active.latitude, active.longitude,active.student_id,active.learning_session_id);
    db.prepare('UPDATE attendance_evidence SET attendance_id=? WHERE tutor_id=? AND attendance_id IS NULL AND created_at>=?').run(attendanceId,req.user.id,active.started_at);
    if(active.learning_session_id) db.prepare("UPDATE learning_sessions SET status='completed',checkout_at=?,topic=? WHERE id=? AND status='ongoing'").run(ts,topic,active.learning_session_id);
    db.prepare('DELETE FROM tutor_active_sessions WHERE tutor_id=?').run(req.user.id);
    audit(req.user.id, 'attendance.checkout_submitted', 'attendance', attendanceId, { startedAt: active.started_at, gpsCaptured: active.latitude !== null && active.longitude !== null });
    return { id: attendanceId, status: 'pending_review', date: ts };
  })();
  res.status(201).json(result);
});

app.post('/api/tutor/attendance', requireAuth('tutor'), requirePermission('tutor.dashboard'), requireCsrf, (req, res) => {
  res.status(410).json({ error: 'Gunakan alur check-in lalu check-out untuk mencatat presensi.' });
});

app.post('/api/tutor/withdrawals', requireAuth('tutor'), requirePermission('tutor.dashboard'), requireCsrf, (req, res) => {
  const amount = Number(req.body?.amount);
  const profile = db.prepare('SELECT bank_code,account_number,account_name FROM tutor_profiles WHERE user_id=?').get(req.user.id);
  if (!Number.isSafeInteger(amount) || amount < 100000 || amount > 100000000) return res.status(400).json({ error: 'Nominal penarikan tidak valid.' });
  if (!profile?.bank_code || !profile.account_number || !profile.account_name) return res.status(400).json({ error: 'Lengkapi dan simpan rekening pencairan di Profil terlebih dahulu.' });
  const withdrawalId = id('WD'); const ts = now();
  try {
    db.transaction(() => {
      const debit = db.prepare('UPDATE tutor_wallets SET available=available-? WHERE user_id=? AND available>=?').run(amount, req.user.id, amount);
      if (!debit.changes) throw Object.assign(new Error('Saldo tidak mencukupi.'), { code: 'INSUFFICIENT_FUNDS' });
      db.prepare('INSERT INTO withdrawals(id,tutor_id,bank,account,amount,status,created_at) VALUES(?,?,?,?,?,?,?)').run(withdrawalId, req.user.id, profile.bank_code, `${profile.account_number} a.n. ${profile.account_name}`, amount, 'pending_admin', ts);
      audit(req.user.id, 'withdrawal.requested', 'withdrawal', withdrawalId, { amount, bank: profile.bank_code, accountNumberLast4: profile.account_number.slice(-4) });
    })();
  } catch (error) { if (error.code === 'INSUFFICIENT_FUNDS') return res.status(409).json({ error: error.message }); throw error; }
  res.status(201).json({ id: withdrawalId, status: 'pending_admin', amount, bank: profile.bank_code, date: ts });
});

app.get('/api/admin/transactions', requireAuth('admin'), requirePermission('admin.manage'), (_req, res) => {
  res.json(db.prepare(`SELECT t.id,t.kind,t.description,t.amount,t.gateway,t.status,t.created_at AS date,u.name AS user,u.email
    FROM transactions t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC LIMIT 500`).all());
});
app.get('/api/admin/overview',requireAuth('admin'),requirePermission('admin.manage'),(_req,res)=>{
  const students=db.prepare("SELECT count(*) AS count FROM users WHERE role='student' AND status='active'").get().count;
  const tutors=db.prepare("SELECT count(*) AS count FROM tutor_details td JOIN users u ON u.id=td.user_id WHERE td.verification_status='verified' AND u.status='active'").get().count;
  const monthStart=new Date();monthStart.setDate(1);monthStart.setHours(0,0,0,0);
  const revenue=db.prepare("SELECT coalesce(sum(amount),0) AS total FROM transactions WHERE ((kind='payment_simulation' AND status='simulated_success') OR (kind='payment_gateway' AND status='paid')) AND created_at>=?").get(monthStart.toISOString()).total;
  const monthly=db.prepare("SELECT strftime('%Y-%m',created_at) AS month,coalesce(sum(amount),0) AS total FROM transactions WHERE ((kind='payment_simulation' AND status='simulated_success') OR (kind='payment_gateway' AND status='paid')) AND created_at>=date('now','start of month','-5 months') GROUP BY month ORDER BY month").all();
  const pendingAttendance=db.prepare("SELECT count(*) AS count FROM attendance WHERE status='pending_review'").get().count;
  const pendingTutor=db.prepare("SELECT count(*) AS count FROM users WHERE role='tutor' AND status='pending_verification'").get().count;
  res.json({students,tutors,revenue,pendingAttendance,pendingTutor,monthly});
});
app.get('/api/admin/attendance', requireAuth('admin'), requirePermission('admin.manage'), (_req, res) => {
  res.json(db.prepare(`SELECT a.id,a.student_name AS student,a.subject,a.topic,a.status,a.honor,a.checkin_latitude AS latitude,a.checkin_longitude AS longitude,a.created_at AS date,u.name AS tutor,
    EXISTS(SELECT 1 FROM attendance_evidence e WHERE e.attendance_id=a.id) AS hasEvidence
    FROM attendance a JOIN users u ON u.id=a.tutor_id ORDER BY a.created_at DESC LIMIT 500`).all());
});
app.post('/api/tutor/evidence',requireAuth('tutor'),requirePermission('tutor.dashboard'),requireCsrf,(req,res)=>{
  const {name,mimeType,data}=req.body||{};
  if(!['image/png','image/jpeg','image/webp'].includes(mimeType)||typeof data!=='string'||data.length>3_000_000)return res.status(400).json({error:'Foto bukti harus PNG, JPG, atau WebP maksimal 2 MB.'});
  let buffer;try{buffer=Buffer.from(data,'base64')}catch{return res.status(400).json({error:'File foto tidak valid.'});}
  const valid=mimeType==='image/png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mimeType==='image/jpeg'?buffer[0]===255&&buffer[1]===216&&buffer[2]===255:buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
  if(!buffer.length||buffer.length>2*1024*1024||!valid)return res.status(400).json({error:'Isi foto tidak valid atau melebihi 2 MB.'});
  const active=db.prepare('SELECT learning_session_id FROM tutor_active_sessions WHERE tutor_id=?').get(req.user.id);if(!active)return res.status(409).json({error:'Mulai check-in sebelum mengunggah foto bukti.'});
  const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mimeType],storageName=`${crypto.randomUUID()}.${ext}`,evidenceId=id('EVD');fs.writeFileSync(path.join(uploadDir,storageName),buffer,{mode:0o600,flag:'wx'});
  db.prepare('INSERT INTO attendance_evidence(id,tenant_id,tutor_id,learning_session_id,storage_name,original_name,mime_type,size_bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(evidenceId,'default',req.user.id,active.learning_session_id,storageName,String(name||'foto-bukti').slice(0,180),mimeType,buffer.length,now());
  audit(req.user.id,'attendance.evidence.uploaded','attendance_evidence',evidenceId,{size:buffer.length,mimeType});res.status(201).json({id:evidenceId,previewUrl:`/api/tutor/evidence/${encodeURIComponent(evidenceId)}`});
});
app.get('/api/tutor/evidence/:id',requireAuth('tutor'),(req,res)=>{
  const file=db.prepare('SELECT tutor_id,storage_name,mime_type FROM attendance_evidence WHERE id=?').get(req.params.id);if(!file||file.tutor_id!==req.user.id)return res.sendStatus(404);res.type(file.mime_type).set('Content-Disposition','inline').sendFile(path.join(uploadDir,file.storage_name));
});
app.get('/api/admin/attendance/:id/evidence',requireAuth('admin'),requirePermission('admin.manage'),(req,res)=>{
  const file=db.prepare('SELECT storage_name,mime_type FROM attendance_evidence WHERE attendance_id=? ORDER BY created_at DESC LIMIT 1').get(req.params.id);if(!file)return res.sendStatus(404);res.type(file.mime_type).set('Content-Disposition','inline').sendFile(path.join(uploadDir,file.storage_name));
});
app.post('/api/admin/attendance/:id/review', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, (req, res) => {
  const decision = req.body?.decision;
  if (!['approve','reject'].includes(decision)) return res.status(400).json({ error: 'Keputusan tidak valid.' });
  try {
    const result = db.transaction(() => {
      const item = db.prepare('SELECT * FROM attendance WHERE id=?').get(req.params.id);
      if (!item || item.status !== 'pending_review') throw Object.assign(new Error('Presensi tidak ada atau sudah diproses.'), { code: 'NOT_PENDING' });
      const status = decision === 'approve' ? 'approved' : 'rejected';
      db.prepare('UPDATE attendance SET status=?,reviewed_at=? WHERE id=? AND status=\'pending_review\'').run(status, now(), item.id);
      if (decision === 'approve') {
        db.prepare('INSERT INTO tutor_wallets(user_id,available) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET available=available+excluded.available').run(item.tutor_id, item.honor);
        db.prepare('INSERT INTO transactions(id,user_id,kind,description,amount,gateway,status,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id('HON'), item.tutor_id, 'honor_accrual', `Honor sesi ${item.subject}: ${item.topic}`, item.honor, 'internal', 'approved', now());
      } else if(item.learning_session_id) {
        const lesson=db.prepare('SELECT student_id,is_free_trial FROM learning_sessions WHERE id=?').get(item.learning_session_id);
        if(lesson?.is_free_trial)db.prepare('UPDATE student_profiles SET free_trial_available=1 WHERE user_id=?').run(lesson.student_id);
        else if(lesson)db.prepare('UPDATE subscriptions SET remaining=remaining+1 WHERE user_id=?').run(lesson.student_id);
        db.prepare("UPDATE learning_sessions SET status='cancelled' WHERE id=?").run(item.learning_session_id);
      }
      audit(req.user.id, `attendance.${status}`, 'attendance', item.id, { tutorId: item.tutor_id, honor: decision === 'approve' ? item.honor : 0 });
      return { id: item.id, status };
    })();
    res.json(result);
  } catch (error) { if (error.code === 'NOT_PENDING') return res.status(409).json({ error: error.message }); throw error; }
});
app.get('/api/admin/withdrawals', requireAuth('admin'), requirePermission('admin.manage'), (_req, res) => {
  res.json(db.prepare(`SELECT w.id,w.bank,w.account,w.amount,w.status,w.created_at AS date,u.name AS tutor,u.email
    FROM withdrawals w JOIN users u ON u.id=w.tutor_id ORDER BY w.created_at DESC LIMIT 500`).all());
});
app.post('/api/admin/withdrawals/:id/review', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, (req, res) => {
  const decision = req.body?.decision;
  if (!['transfer','reject'].includes(decision)) return res.status(400).json({ error: 'Keputusan tidak valid.' });
  try {
    const result = db.transaction(() => {
      const item = db.prepare('SELECT * FROM withdrawals WHERE id=?').get(req.params.id);
      if (!item || item.status !== 'pending_admin') throw Object.assign(new Error('Pengajuan tidak ada atau sudah diproses.'), { code: 'NOT_PENDING' });
      const status = decision === 'transfer' ? 'transferred' : 'rejected';
      db.prepare('UPDATE withdrawals SET status=?,reviewed_at=? WHERE id=? AND status=\'pending_admin\'').run(status, now(), item.id);
      if (decision === 'reject') db.prepare('UPDATE tutor_wallets SET available=available+? WHERE user_id=?').run(item.amount, item.tutor_id);
      else db.prepare('INSERT INTO transactions(id,user_id,kind,description,amount,gateway,status,created_at) VALUES(?,?,?,?,?,?,?,?)').run(item.id, item.tutor_id, 'withdrawal', `Pencairan honor ke ${item.bank}`, -item.amount, 'bank_transfer_simulation', 'simulated_success', now());
      audit(req.user.id, `withdrawal.${status}`, 'withdrawal', item.id, { tutorId: item.tutor_id, amount: item.amount });
      return { id: item.id, status };
    })();
    res.json(result);
  } catch (error) { if (error.code === 'NOT_PENDING') return res.status(409).json({ error: error.message }); throw error; }
});
app.get('/api/admin/audit-events', requireAuth('admin'), requirePermission('admin.manage'), (_req, res) => {
  res.json(db.prepare(`SELECT a.id,a.action,a.target_type AS targetType,a.target_id AS targetId,a.details,a.created_at AS date,u.name AS actor
    FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 500`).all());
});
app.get('/api/admin/tutor-registrations', requireAuth('admin'), requirePermission('admin.manage'), (_req, res) => {
  const registrations=db.prepare("SELECT id,name,email,created_at AS date FROM users WHERE role='tutor' AND status='pending_verification' ORDER BY created_at LIMIT 500").all();
  res.json(registrations.map(user=>({...user,documents:db.prepare("SELECT id,original_name AS name,mime_type AS mimeType,size_bytes AS size FROM uploads WHERE user_id=? AND purpose='tutor_document' ORDER BY created_at DESC").all(user.id)})));
});
app.post('/api/admin/tutor-registrations/:id/review', requireAuth('admin'), requirePermission('admin.manage'), requireCsrf, (req, res) => {
  const decision = req.body?.decision;
  if (!['approve','reject'].includes(decision)) return res.status(400).json({ error: 'Keputusan tidak valid.' });
  const status = decision === 'approve' ? 'active' : 'rejected';
  const result = db.prepare("UPDATE users SET status=? WHERE id=? AND role='tutor' AND status='pending_verification'").run(status, req.params.id);
  if (!result.changes) return res.status(409).json({ error: 'Pendaftaran tidak ada atau sudah diproses.' });
  db.prepare('UPDATE tutor_details SET verification_status=?,verified_at=? WHERE user_id=?').run(decision==='approve'?'verified':'rejected',decision==='approve'?now():null,req.params.id);
  audit(req.user.id, `tutor_registration.${decision}`, 'user', req.params.id);
  res.json({ id: req.params.id, status });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (!res.headersSent) res.status(500).json({ error: 'Terjadi kesalahan server.' });
});

// Role dashboards are never served by the public static-file middleware.
app.get('/dashboard-student.html', requireAuth('student'), requirePermission('student.dashboard'), (req, res) => res.sendFile(path.join(__dirname, 'dashboard-student.html')));
app.get('/dashboard-tutor.html', requireAuth('tutor'), requirePermission('tutor.dashboard'), (req, res) => res.sendFile(path.join(__dirname, 'dashboard-tutor.html')));
app.get('/dashboard-admin.html', requireAuth('admin'), requirePermission('admin.manage'), (req, res) => res.sendFile(path.join(__dirname, 'dashboard-admin.html')));
app.get('/dashboard-staff.html', requireAuth(), (req,res) => ['keuangan','marketing','front_office','back_office'].includes(req.user.role) ? res.sendFile(path.join(__dirname,'dashboard-staff.html')) : res.redirect(req.user.role==='guru'?'/dashboard-tutor.html':req.user.role==='student'?'/dashboard-student.html':'/dashboard-admin.html'));
app.get('/dashboard-student', requireAuth('student'), requirePermission('student.dashboard'), (req, res) => res.sendFile(path.join(__dirname, 'dashboard-student.html')));
app.get('/dashboard-tutor', requireAuth('tutor'), requirePermission('tutor.dashboard'), (req, res) => res.sendFile(path.join(__dirname, 'dashboard-tutor.html')));
app.get('/dashboard-admin', requireAuth('admin'), requirePermission('admin.manage'), (req, res) => res.sendFile(path.join(__dirname, 'dashboard-admin.html')));

// The remaining front-end prototype is public. Never put secrets in these files.
app.use(['/data', '/server.js', '/package.json', '/package-lock.json', '/README.md', '/STANDARDS_ALIGNMENT.md'], (_req, res) => res.sendStatus(404));
app.use(express.static(__dirname, { extensions: ['html', 'htm'], dotfiles: 'deny', index: 'index.html' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

async function start() {
  await seedDevelopmentUsers();
  app.listen(PORT, () => {
    console.log(`Trevy running at http://localhost:${PORT} (${IS_PRODUCTION ? 'production' : 'development'} mode)`);
    if (!IS_PRODUCTION) console.log('Development demo accounts are enabled. Do not use this mode for public deployment.');
  });
}
start().catch(error => { console.error(error.message); process.exit(1); });
