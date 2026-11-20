#!/bin/bash
# ═══════════════════════════════════════════════════════
#  TREVY — Install & Run Script
#  Script ini menginstall semua dependencies
#  lalu menjalankan development server.
# ═══════════════════════════════════════════════════════

set -e

echo ""
echo "  📚 TREVY — Hub Guru Les Privat Semarang"
echo "  ========================================="
echo ""

# ── Cek Node.js ──
if ! command -v node &> /dev/null; then
    echo "  ❌ Node.js tidak ditemukan!"
    echo "  Silakan install Node.js terlebih dahulu:"
    echo "  https://nodejs.org/"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v)
echo "  ✅ Node.js ditemukan: $NODE_VERSION"

# ── Cek npm ──
if ! command -v npm &> /dev/null; then
    echo "  ❌ npm tidak ditemukan!"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "  ✅ npm ditemukan: v$NPM_VERSION"
echo ""

# ── Install Dependencies ──
echo "  📦 Menginstall dependencies..."
echo "  ─────────────────────────────"
npm install
echo ""
echo "  ✅ Dependencies berhasil diinstall!"
echo ""

# ── Jalankan Server ──
echo "  🚀 Menjalankan development server..."
echo "  ─────────────────────────────────────"
echo ""
npm start

