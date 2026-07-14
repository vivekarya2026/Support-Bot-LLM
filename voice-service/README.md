# SupportKit Voice Service

Loopback-only FastAPI sidecar providing speech-to-text (faster-whisper) and
text-to-speech (Coqui TTS, maintained idiap fork) for the SupportKit widget.
**Only the Next.js server talks to this process** — it binds to `127.0.0.1`
and never sees botKeys or end users.

## Setup

```bash
# one-time (needs Python 3.11 and espeak-ng)
brew install espeak-ng          # macOS; Debian/Ubuntu: apt install espeak-ng
bash setup.sh

# optional but recommended: pre-download all models (~1 GB total)
.venv/bin/python scripts/warm.py

# run (or from the repo root: npm run dev:voice / npm run dev:all)
bash run.sh
```

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | `{ok, stt:{model,loaded}, tts:{engine,loaded,languages}}` — `loaded:false` while models warm |
| `GET /voices` | Voice catalog with per-voice `license` field |
| `POST /stt` | multipart `file` (+ optional `language` hint) → `{text, language, language_probability, duration_sec}` |
| `POST /tts` | JSON `{text, language, voice_id?}` → `audio/wav`; `422 language_unsupported` when no voice exists |

Browser audio (Chrome `webm/opus`, Safari `mp4/AAC`) is decoded directly by
PyAV — no ffmpeg install, no transcoding layer.

## Configuration (env)

| Var | Default | Meaning |
|---|---|---|
| `VOICE_PORT` | `8078` | bind port (loopback only) |
| `WHISPER_MODEL` | `small` | tiny/base/small/medium (CPU: stay ≤ small for interactive use) |
| `WHISPER_COMPUTE` | `int8` | CTranslate2 compute type |
| `TTS_ENGINE` | `vits` | `vits` \| `xtts` |
| `VITS_MODELS` | en,hi,es,fr,de set | comma-separated `lang=model[#speaker]` |
| `MAX_TTS_CHARS` | `2000` | synthesis cap |
| `MAX_STT_SECONDS` | `120` | upload duration cap |
| `MODEL_CACHE_DIR` | `~/.cache/supportkit-voice` | model downloads |
| `MAX_CONCURRENCY` | `2` | parallel heavy jobs |
| `COQUI_TOS_AGREED` | unset | **required** to enable XTTS (see licensing) |
| `XTTS_SPEAKER` / `XTTS_SPEAKER_WAV` | Claribel Dervla / — | XTTS reference voice |

## Model licensing — read before shipping commercially

| Model | License | Commercial use |
|---|---|---|
| Coqui TTS **code** (idiap fork) | MPL-2.0 | ✅ yes |
| faster-whisper + Whisper weights | MIT | ✅ yes |
| `en/vctk/vits`, `es|fr/css10/vits`, `de/thorsten/vits` | per model zoo metadata (surfaced in `/voices`) | verify per model |
| `hin/fairseq/vits` (and all fairseq/MMS bridge models) | **CC-BY-NC-4.0** | ❌ non-commercial only |
| **XTTS-v2 weights** | **CPML** | ❌ non-commercial only — Coqui is defunct; no commercial license can be purchased |

The engine refuses to load XTTS unless `TTS_ENGINE=xtts` **and**
`COQUI_TOS_AGREED=1` are both set. Every `/voices` entry carries its `license`
so the admin UI can badge non-commercial voices.

## Latency reference (Apple Silicon, CPU-only, measured 2026-07)

| Operation | Time |
|---|---|
| STT: 9 s clip, whisper `small`/int8 | ~2.1 s (wav, m4a, webm identical) |
| TTS: 200 chars, VITS VCTK | ~2.0 s |
| TTS: Hindi fairseq VITS | ~0.7 s |
| Model loads (lazy, first request) | whisper 0.8 s · VITS 0.3–5 s |
