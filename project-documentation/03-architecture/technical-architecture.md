---
document_type: technical_architecture
version: "1.0.0"
status: approved
created_by: system_architect
project: "supportkit-voice-module"
depends_on:
  - document: "01-requirements/product-requirements.md"
    version: ">=1.0.0"
  - document: "02-design/design-brief.md"
    version: ">=1.0.0"
date: 2026-07-13
---

# Technical Architecture: SupportKit Voice Module

## System overview

```
Browser widget (often a cross-origin iframe on a customer site)
   │ multipart audio          │ JSON → audio/wav        │ once per panel mount
   ▼                          ▼                          ▼
POST /api/stt            POST /api/tts           GET /api/voice/health
   │   Next.js route handlers (runtime=nodejs) validate botKey via
   │   getBotByPublicKey and enforce per-bot voice flags
   ▼
voice-service  (FastAPI · uvicorn · 127.0.0.1:8078 · loopback only)
   ├─ faster-whisper  — STT, ~100 languages, auto language detection (MIT)
   └─ TTSEngine ABC ──┬─ VITSEngine  (default; commercial-safe; CPU-fast)
                      └─ XTTSEngine  (opt-in; CPML non-commercial; license-gated)
```

**Invariant**: voice failure never breaks text chat. The sidecar is reached only through Next.js; if it is down, `/api/voice/health` reports unavailable and the widget renders zero voice affordances.

## Technology stack decisions

| Layer | Choice | Why |
|---|---|---|
| STT | faster-whisper (CTranslate2) | MIT license; auto language detect; PyAV decodes browser codecs (webm/opus, mp4/AAC) with no ffmpeg dependency; CPU int8 viable for `small` |
| TTS | coqui-tts (idiap fork, MPL-2.0) | Requested stack; maintained fork of archived coqui-ai/TTS |
| TTS default engine | VITS per-language models | Commercial-safe (per-model licenses recorded in catalog); ~real-time on CPU |
| TTS optional engine | XTTS-v2 | 17 languages, one model — but CPML weights (non-commercial only) and 10–30 s/reply on CPU ⇒ config-gated, requires `COQUI_TOS_AGREED=1` |
| Sidecar | FastAPI + uvicorn, Python 3.11 | coqui-tts requires Python >=3.10,<3.13; repo previously had no Python — isolated in `voice-service/` with its own venv |
| Transport widget↔server | Existing HTTPS + multipart / JSON | No WebSockets introduced; matches app architecture (SSE for chat stays untouched) |

Pinned gotcha: `coqui-tts==0.27.x` is incompatible with `transformers>=5` (imports `isin_mps_friendly`, removed in v5) → `requirements.txt` pins `transformers>=4.44,<5`. torch/torchaudio are peer deps not pulled by coqui-tts and are listed explicitly.

## Data model (SQLite, `user_version` 1 → 2)

New columns on `bots` (both in `CREATE TABLE` for fresh installs and in `migrateToV2` with `hasColumn` guards for legacy DBs):

| Column | Type/Default | Purpose |
|---|---|---|
| `voice_enabled` | INTEGER 0 | master switch (off ⇒ nothing voice-related renders) |
| `stt_enabled` | INTEGER 1 | sub-switch |
| `tts_enabled` | INTEGER 1 | sub-switch |
| `voice_autoplay` | INTEGER 0 | auto-speak settled replies |
| `handsfree_enabled` | INTEGER 0 | conversation mode toggle in widget header |
| `voice_language` | TEXT 'auto' | `'auto'` = follow detection; else fixed ISO 639-1 |
| `tts_voices` | TEXT '{}' | JSON map language → voice id, e.g. `{"en":"vits:en:vctk:p225"}` |
| `reply_in_user_language` | INTEGER 1 | gate for LLM language steering |

Audio is **never persisted** — request-scoped buffers only (SEC-PM-001). TTS disk cache (Phase D) stores synthesized WAVs keyed `sha256(botId|voiceId|lang|text)` under `data/tts-cache/` (gitignored) — cache of public bot output, not user data.

## API contracts

### Sidecar (loopback only)
| Endpoint | In | Out |
|---|---|---|
| `GET /health` | — | `{ok, stt:{model,loaded}, tts:{engine,loaded,languages[]}}` (200 with `loaded:false` while warming) |
| `GET /voices` | — | `{voices:[{id,engine,language,name,license}]}` |
| `POST /stt` | multipart `file`, opt `language` | `{text, language, language_probability, duration_sec}`; 413 > `MAX_STT_SECONDS` |
| `POST /tts` | `{text, language, voice_id?}` | `audio/wav` bytes; 422 `{error:"language_unsupported"}` |

### Next.js (public, botKey-authenticated like `/api/chat`)
| Route | Contract |
|---|---|
| `GET /api/voice/health?botKey=` | `{voice:{available,stt,tts,languages[]}}` — available = bot flag ∧ global setting ∧ sidecar healthy |
| `POST /api/stt` | multipart `botKey,audio,language?` → `{text,language,confidence}`; 403 flags off; 413 >10 MB; 503 sidecar down |
| `POST /api/tts` | JSON `{botKey,text,language?,messageId?}` → `audio/wav` stream; 2000-char cap; 422 unsupported language; with `messageId`, server loads the persisted reply and ignores client text |
| `GET /api/admin/voice` | admin-only `{health,voices}` for the settings UI (full catalog never on the public surface) |

`/api/chat` additions: request gains `language?`; response stream gains `event: message` `data:{"id":N}` (persisted assistant row id) before `done`.

## Language resolution (single-owner rule)

The capability funnel **Whisper(~100) ⊃ XTTS(17) ⊇ installed VITS set** is resolved in exactly two functions: `registry.resolve()` in the sidecar (voice catalog truth) and `resolveTtsTarget(bot, lang)` in `lib/voice.ts` (per-bot preference walk: `tts_voices[lang]` → any catalog voice for lang → null ⇒ 422 ⇒ widget text-only notice). Detection below 0.6 confidence is treated as unknown (no LLM steering).

## Security architecture

- **Auth**: none exists in the app (documented local-first stance); voice endpoints match `/api/chat`'s botKey-only model. Compensating controls for the new CPU-expensive surface: 10 MB / 120 s STT caps, 2000-char TTS cap, `asyncio.Semaphore(2)` in the sidecar, per-bot in-memory token bucket in `lib/voice.ts`.
- **License gate**: XTTSEngine refuses to instantiate without `COQUI_TOS_AGREED=1` and its catalog entries carry `license:"CPML-noncommercial"`; admin UI surfaces the label.
- **Iframe permission**: `embed.js` sets `allow="clipboard-write; microphone"`; customer pages must be HTTPS; a hostile/locked-down page can block delegation → widget hides mic on `NotAllowedError`.
- **Input validation**: PATCH validator whitelists voice fields (booleans → 0|1, `voiceLanguage` regex, `ttsVoices` string-record); sidecar sanitizes TTS text (strip `[n]` citations, markdown) — prevents both spoken artifacts and prompt-shaped garbage reaching the synthesizer.

## Infrastructure & operations

- Dev: `npm run dev:all` (concurrently: next dev + `voice-service/run.sh`); sidecar port `VOICE_PORT=8078`; repo path contains a space ⇒ all scripts quote paths.
- Model cache: `MODEL_CACHE_DIR` (default `~/.cache/supportkit-voice`); first use downloads models (hundreds of MB) — `scripts/warm.py` pre-downloads; `/health` exposes `loaded:false` during warm-up.
- Apple Silicon note: CTranslate2 is CPU-only on macOS — `WHISPER_MODEL=small`+`int8` is the interactive ceiling; XTTS is effectively non-interactive on CPU (second reason it is not the default).
- No new persistent services beyond the sidecar; no queues; failure mode is stateless degradation.

## Development roadmap
Phases B→E as defined in the approved plan (spike → foundation → hands-free/language loop → deferred XTTS/streaming). See `_meta/decision-log.md` for ADRs.

## Technical risks
| Risk | L | I | Mitigation |
|---|---|---|---|
| Hands-free end-to-end latency (STT+LLM+TTS on CPU) | M | H | Streaming captions hide LLM time; Whisper `small`; sentence-cap TTS; spike gates scope |
| Hindi VITS (fairseq) quality | M | M | Spike listens; fallback = Hindi STT-only at launch, TTS via XTTS on non-commercial installs |
| Sidecar/Next version drift | L | M | `/health` carries engine+model identity; `lib/voice.ts` tolerates unknown fields |
| transformers/coqui pin rot | M | L | Pin recorded in requirements.txt with comment; setup.sh verifies imports |
