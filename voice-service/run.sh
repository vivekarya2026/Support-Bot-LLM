#!/usr/bin/env bash
# Start the SupportKit voice service (loopback only).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "No venv found — running setup.sh first..."
  bash setup.sh
fi

exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "${VOICE_PORT:-8078}"
