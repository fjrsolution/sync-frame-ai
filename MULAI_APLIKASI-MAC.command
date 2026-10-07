#!/bin/bash
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)"
failed() {
  result=$?
  if [ "$result" -ne 0 ]; then
    echo "Persiapan gagal. Periksa pesan di atas, internet, ruang disk, dan folder logs."
    read -r -p "Tekan Enter untuk menutup..." || true
  fi
}
trap failed EXIT
if [ "$(uname -s)" != Darwin ]; then
  echo "Launcher ini khusus macOS. Gunakan MULAI-APLIKASI.bat pada Windows."
  exit 1
fi
if [ "$(uname -m)" != arm64 ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" != 1 ]; then
  echo "AI lengkap memerlukan Mac Apple Silicon (M1 atau lebih baru). Mac Intel belum didukung paket AI ini."
  exit 1
fi
if [ "$(sw_vers -productVersion | cut -d. -f1)" -lt 14 ]; then
  echo "Paket AI ini memerlukan macOS 14 atau lebih baru."
  exit 1
fi
mkdir -p .runtime logs
exec > >(tee -a logs/bootstrap-macos.log) 2>&1
export UV_PYTHON_INSTALL_DIR="$PWD/.runtime/python"
export UV_CACHE_DIR="$PWD/.runtime/uv-cache"
export UV_PYTHON_INSTALL_BIN=0 UV_NO_CONFIG=1 PYTHONUTF8=1
export FRAMESYNC_UV="$PWD/.runtime/uv"
if [ ! -x "$FRAMESYNC_UV" ]; then
  echo "Mengunduh installer Python lokal (uv)..."
  asset=uv-aarch64-apple-darwin.tar.gz
  base="https://github.com/astral-sh/uv/releases/download/0.8.22/$asset"
  curl --fail --location --retry 3 --connect-timeout 20 --max-time 300 "$base" -o ".runtime/$asset"
  curl --fail --location --retry 3 --connect-timeout 20 --max-time 60 "$base.sha256" -o ".runtime/$asset.sha256"
  expected="$(awk '{print $1; exit}' ".runtime/$asset.sha256")"
  actual="$(shasum -a 256 ".runtime/$asset" | awk '{print $1}')"
  if [ "${#expected}" -ne 64 ] || [ "$actual" != "$expected" ]; then
    echo "Checksum unduhan uv tidak cocok. Jalankan ulang untuk mengunduh kembali."
    exit 1
  fi
  tar -xzf ".runtime/$asset" -C .runtime
  mv .runtime/uv-aarch64-apple-darwin/uv "$FRAMESYNC_UV"
  chmod +x "$FRAMESYNC_UV"
fi
echo "Menyiapkan Python 3.11 khusus project (tanpa instal manual)..."
"$FRAMESYNC_UV" python install 3.11
PYTHON="$("$FRAMESYNC_UV" python find --managed-python 3.11)"
"$PYTHON" scripts/launcher.py
