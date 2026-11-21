const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...options });
  if (result.error) return { ok: false, error: result.error.message };
  return { ok: result.status === 0, status: result.status };
}

function initializeLocalEnv() {
  if (fs.existsSync(envPath)) {
    console.log('Memakai .env yang sudah ada.');
    return;
  }
  let env = fs.readFileSync(examplePath, 'utf8');
  env = env
    .replace(/^TREVY_DB_PATH=.*$/m, 'TREVY_DB_PATH=./trevy-data/trevy.sqlite')
    .replace(/^TREVY_UPLOAD_DIR=.*$/m, 'TREVY_UPLOAD_DIR=./trevy-data/trevy-uploads')
    .replace(/^TREVY_PUBLIC_URL=.*$/m, 'TREVY_PUBLIC_URL=http://localhost:3000')
    .replace(/^TREVY_ENCRYPTION_KEY=.*$/m, `TREVY_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('base64')}`);
  fs.writeFileSync(envPath, env, { mode: 0o600, flag: 'wx' });
  console.log('Membuat .env lokal dan encryption key acak. File .env tidak masuk Git.');
}

console.log('Menyiapkan Trevy untuk laptop ini…');
const version = process.versions.node.split('.').map(Number);
if (version[0] < 22) {
  console.error(`Trevy memerlukan Node.js 22 atau lebih baru. Versi terdeteksi: ${process.versions.node}`);
  process.exit(1);
}

initializeLocalEnv();
fs.mkdirSync(path.join(root, 'trevy-data'), { recursive: true });

const install = run('npm', ['install']);
if (!install.ok) process.exit(install.status || 1);

const extensionIds = [
  'esbenp.prettier-vscode',
  'dbaeumer.vscode-eslint',
  'qwtel.sqlite-viewer',
  'ms-ossdata.vscode-postgresql'
];
const code = run('code', ['--version'], { stdio: 'ignore' });
if (code.ok) {
  for (const id of extensionIds) {
    const result = run('code', ['--install-extension', id, '--force']);
    if (!result.ok) console.warn(`Ekstensi ${id} gagal dipasang otomatis. Pasang dari daftar rekomendasi VS Code.`);
  }
} else {
  console.log('VS Code CLI "code" tidak ditemukan; daftar extension tetap tersedia di .vscode/extensions.json.');
}

console.log('Setup selesai. Menjalankan server development di http://localhost:3000');
const dev = run('npm', ['run', 'dev']);
process.exit(dev.status || 0);
