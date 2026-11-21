/* ===================================================================
   TREVY — Netlify PostgreSQL Bi-directional Synchronization
   Synchronizes local serverless state with Netlify Cloud PostgreSQL
   =================================================================== */

const { Pool } = require('pg');

let pool = null;
let lastFullSync = 0;
const FULL_SYNC_INTERVAL_MS = 2000; // sync at most once every 2 seconds on reads

const DEFAULT_PG_URL = 'postgresql://netlifydb_owner:npg_KQEM0wUCkH8B@ep-misty-scene-bd823a7b.c-8.us-east-2.db.netlify.com/netlifydb?sslmode=require';

function getConnectionString() {
  return process.env.NETLIFY_DATABASE_URL ||
         process.env.DATABASE_URL ||
         process.env.TREVY_DATABASE_URL ||
         DEFAULT_PG_URL;
}

function getPool() {
  if (pool) return pool;
  const connStr = getConnectionString();
  if (!connStr) return null;
  try {
    pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 4,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000
    });
    pool.on('error', err => {
      console.warn('[PostgresSync] Pool error:', err.message);
    });
    return pool;
  } catch (err) {
    console.error('[PostgresSync] Failed to initialize pool:', err.message);
    return null;
  }
}

const toSqliteVal = v => {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && !Buffer.isBuffer(v)) return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
};

function toPgSql(sql) {
  let idx = 1;
  let s = sql.replace(/\?/g, () => `$${idx++}`);
  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  s = s.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
  s = s.replace(/datetime\('now'\)/gi, 'NOW()');
  return s;
}

const SYNCED_TABLES = [
  'tenant_settings',
  'roles',
  'permissions',
  'role_permissions',
  'packages',
  'subjects',
  'users',
  'user_roles',
  'user_groups',
  'user_group_members',
  'student_profiles',
  'subscriptions',
  'learning_subscriptions',
  'learning_sessions',
  'session_reviews',
  'tutor_details',
  'tutor_profiles',
  'tutor_wallets',
  'tutor_availability',
  'transactions',
  'withdrawals',
  'attendance',
  'attendance_evidence',
  'user_preferences'
];

async function syncTable(sqliteDb, table) {
  const p = getPool();
  if (!p) return 0;
  try {
    const res = await p.query(`SELECT * FROM ${table}`);
    if (!res.rows || !res.rows.length) return 0;
    const cols = Object.keys(res.rows[0]);
    const placeholders = cols.map(() => '?').join(',');
    const stmt = sqliteDb.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`);
    sqliteDb.pragma('foreign_keys = OFF');
    try {
      const tx = sqliteDb.transaction(rows => {
        for (const row of rows) {
          stmt.run(...cols.map(c => toSqliteVal(row[c])));
        }
      });
      tx(res.rows);
    } finally {
      sqliteDb.pragma('foreign_keys = ON');
    }
    return res.rows.length;
  } catch (err) {
    console.warn(`[PostgresSync] Table sync error for ${table}:`, err.message);
    return 0;
  }
}

async function syncAll(sqliteDb, force = false) {
  const now = Date.now();
  if (!force && now - lastFullSync < FULL_SYNC_INTERVAL_MS) {
    return;
  }
  const p = getPool();
  if (!p) return;
  lastFullSync = now;
  sqliteDb.pragma('foreign_keys = OFF');
  try {
    for (const table of SYNCED_TABLES) {
      await syncTable(sqliteDb, table);
    }
  } finally {
    sqliteDb.pragma('foreign_keys = ON');
  }
}

async function syncUser(sqliteDb, idOrEmail) {
  const p = getPool();
  if (!p || !idOrEmail) return null;
  try {
    const val = String(idOrEmail).trim().toLowerCase();
    const res = await p.query('SELECT * FROM users WHERE id = $1 OR lower(email) = $1 LIMIT 1', [val]);
    if (!res.rows.length) return null;
    const user = res.rows[0];
    const cols = Object.keys(user);
    const placeholders = cols.map(() => '?').join(',');
    sqliteDb.pragma('foreign_keys = OFF');
    try {
      sqliteDb.prepare(`INSERT OR REPLACE INTO users (${cols.join(',')}) VALUES (${placeholders})`)
        .run(...cols.map(c => toSqliteVal(user[c])));

      // Sync roles for this user
      const rolesRes = await p.query('SELECT * FROM user_roles WHERE user_id = $1', [user.id]);
      if (rolesRes.rows.length) {
        const rCols = Object.keys(rolesRes.rows[0]);
        const rPlaceholders = rCols.map(() => '?').join(',');
        const rStmt = sqliteDb.prepare(`INSERT OR REPLACE INTO user_roles (${rCols.join(',')}) VALUES (${rPlaceholders})`);
        for (const r of rolesRes.rows) {
          rStmt.run(...rCols.map(c => toSqliteVal(r[c])));
        }
      }

      // Sync student profile if student
      if (user.role === 'student') {
        const spRes = await p.query('SELECT * FROM student_profiles WHERE user_id = $1', [user.id]);
        if (spRes.rows.length) {
          const spCols = Object.keys(spRes.rows[0]);
          sqliteDb.prepare(`INSERT OR REPLACE INTO student_profiles (${spCols.join(',')}) VALUES (${spCols.map(() => '?').join(',')})`)
            .run(...spCols.map(c => toSqliteVal(spRes.rows[0][c])));
        }
        const subRes = await p.query('SELECT * FROM subscriptions WHERE user_id = $1', [user.id]);
        if (subRes.rows.length) {
          const subCols = Object.keys(subRes.rows[0]);
          sqliteDb.prepare(`INSERT OR REPLACE INTO subscriptions (${subCols.join(',')}) VALUES (${subCols.map(() => '?').join(',')})`)
            .run(...subCols.map(c => toSqliteVal(subRes.rows[0][c])));
        }
      }
    } finally {
      sqliteDb.pragma('foreign_keys = ON');
    }

    return user;
  } catch (err) {
    console.warn('[PostgresSync] syncUser error:', err.message);
    return null;
  }
}

async function replicateWrite(sql, params = []) {
  const p = getPool();
  if (!p) return;
  try {
    let pgSql = toPgSql(sql);
    const flatParams = params.flat().map(v => (v === undefined ? null : v));
    await p.query(pgSql, flatParams);
  } catch (err) {
    console.warn('[PostgresSync] Replicate write error:', err.message, '| SQL:', sql);
  }
}

module.exports = {
  getPool,
  syncAll,
  syncTable,
  syncUser,
  replicateWrite,
  toPgSql,
  toSqliteVal
};
