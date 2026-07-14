#!/usr/bin/env bash
# Build STT test fixtures using macOS built-ins:
#   fixture.wav  — 16 kHz PCM reference
#   fixture.m4a  — AAC (what Safari's MediaRecorder produces, mp4/AAC family)
#   fixture.webm — opus (Chrome) — created by spike.py via PyAV
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/fixtures

TEXT="Hello, I ordered a blue backpack last week and it still has not shipped. Can you check the status of my order and tell me when it will arrive?"

say -o tests/fixtures/fixture.aiff "$TEXT"
afconvert -f WAVE -d LEI16@16000 -c 1 tests/fixtures/fixture.aiff tests/fixtures/fixture.wav
afconvert -f m4af -d aac tests/fixtures/fixture.aiff tests/fixtures/fixture.m4a
rm tests/fixtures/fixture.aiff
ls -la tests/fixtures
