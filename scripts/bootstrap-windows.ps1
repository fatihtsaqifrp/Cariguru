$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Test-Node22 {
  try {
    $Version = (& node -p "Number(process.versions.node.split('.')[0])" 2>$null | Select-Object -First 1)
    return ([int]$Version -ge 22)
  } catch {
    return $false
  }
}

if (-not (Test-Node22)) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "Node.js 22+ belum ada dan winget tidak ditemukan. Pasang Node.js LTS dari https://nodejs.org/en/download lalu jalankan kembali skrip ini."
  }
  winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  $NodeInstallPath = Join-Path $env:ProgramFiles 'nodejs'
  if (Test-Path $NodeInstallPath) { $env:PATH = "$NodeInstallPath;$env:PATH" }
  if (-not (Test-Node22)) { throw 'Node.js terpasang. Tutup dan buka kembali PowerShell, lalu jalankan skrip bootstrap ini lagi.' }
}

Set-Location $ProjectRoot
& npm.cmd run setup:laptop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
