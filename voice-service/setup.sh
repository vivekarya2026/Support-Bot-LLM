#!/usr/bin/env bash
# One-time setup for the SupportKit voice service.
# Creates a Python 3.11 venv and installs pinned dependencies.
set -euo pipefail
cd "$(dirname "$0")"

# VITS phonemization requires espeak-ng at the system level.
if ! command -v espeak-ng >/dev/null 2>&1 && ! command -v espeak >/dev/null 2>&1; then
  echo "WARNING: espeak-ng not found. Install it first (macOS: brew install espeak-ng," >&2
  echo "         Debian/Ubuntu: apt install espeak-ng) or VITS synthesis will fail." >&2
fi

if command -v uv >/dev/null 2>&1; then
  [ -d .venv ] || uv venv --python 3.11 .venv
  uv pip install --python .venv/bin/python -r requirements.txt
else
  [ -d .venv ] || python3.11 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

.venv/bin/python -c "import TTS, faster_whisper; print('voice-service deps OK: coqui', TTS.__version__, '| faster-whisper', faster_whisper.__version__)"
