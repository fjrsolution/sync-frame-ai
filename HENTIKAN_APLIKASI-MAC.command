#!/bin/bash
set -u

pids="$(lsof -tiTCP:8000 -sTCP:LISTEN 2>/dev/null || true)"
if [ -z "$pids" ]; then
  echo "FrameSync AI tidak sedang berjalan."
else
  kill $pids
  echo "FrameSync AI dihentikan."
fi
read -r -p "Tekan Enter untuk menutup..."
