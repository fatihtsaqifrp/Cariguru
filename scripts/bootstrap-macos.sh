#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

has_node_22() {
  command -v node >/dev/null 2>&1 || return 1
  local major
  major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  [[ "$major" -ge 22 ]]
}

if ! has_node_22; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "Node.js 22+ belum ada dan Homebrew tidak ditemukan. Pasang Node.js LTS dari https://nodejs.org/en/download lalu jalankan kembali skrip ini."
    exit 1
  fi
  brew install node@22
  export PATH="$(brew --prefix node@22)/bin:$PATH"
fi

cd "$PROJECT_ROOT"
npm run setup:laptop
