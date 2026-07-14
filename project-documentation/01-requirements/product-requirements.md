---
document_type: requirements
version: "1.0.0"
status: approved
created_by: product_manager
project: "supportkit-voice-module"
scope: MVP
date: 2026-07-13
---

# Product Requirements: SupportKit Voice Module (STT + TTS, Multi-Language)

## Executive Summary

### Elevator Pitch
Talk to the support bot like a person: press the mic (or go hands-free), speak in your own language, and hear the answer spoken back.

### Problem Statement
Typing is a barrier for a large share of support users: mobile visitors, people with motor or vision impairments, and customers more comfortable speaking than writing — especially in non-English languages. SupportKit today is text-only and English-only, which caps resolution rates and excludes users the white-label clients care about.

### Target Audience
End-customers of businesses that embed the SupportKit widget (primary), and workspace admins who configure each bot (secondary).

### Unique Value Proposition
Fully self-hosted, open-source voice stack (Coqui TTS + faster-whisper) — no per-minute cloud voice fees, no audio leaves the operator's infrastructure, and voice is a per-bot white-label toggle.

### Scope
- Type: MVP (hands-free conversation included by explicit stakeholder decision)
- Languages at launch: English, Hindi, Spanish, French, German (STT auto-detects ~100)

## User Personas

### Priya — Mobile visitor who prefers speaking
- **Role**: End-customer on a client's site, on her phone, mid-task
- **Technical comfort**: Medium; **Context**: one-handed, on the move, may be a Hindi speaker who types English slowly
- **Goals**: Get an answer without typing paragraphs on a phone keyboard
- **Frustrations**: Tiny text boxes; support that only "speaks" English
- **Quote**: "I can explain the problem in ten seconds if I can just say it."
- **Usage pattern**: Short, task-driven sessions; will abandon after one bad turn

### Sam — Accessibility-dependent user
- **Role**: End-customer with low vision / motor impairment, uses voice as primary input
- **Technical comfort**: High with assistive tech
- **Goals**: Complete a support interaction without a keyboard; hear responses aloud
- **Frustrations**: Widgets that trap focus, unlabeled buttons, audio that fights the screen reader
- **Quote**: "If the mic button isn't labeled, I'll never find it."

### Dana — Workspace admin (secondary)
- **Role**: Configures bots for client sites in the SupportKit admin
- **Goals**: Turn voice on per bot, pick voices per language, trust that it can't break text chat
- **Frustrations**: Features that require infra knowledge; licensing surprises on white-label deployments

## Feature Prioritisation (MoSCoW)

### MUST Have
| Feature | User Value | Complexity | Notes |
|---|---|---|---|
| Push-to-talk mic in composer | Speak instead of type; transcript editable before send | M | Foundation for all voice input |
| Server STT (faster-whisper) with language auto-detect | Works in ~100 languages, no browser lottery | M | Python sidecar |
| Per-message TTS playback (speaker button) | Hear any bot reply aloud | M | VITS default engine |
| Hands-free conversation mode | Speak → hear reply → mic re-arms | L | Stakeholder-selected MVP scope; half-duplex |
| Reply-in-user's-language loop | Bot answers in the language spoken | M | Prompt injection from detected lang |
| Per-bot voice settings (admin) | White-label control; off by default | M | DB migration v2 |
| Graceful degradation everywhere | Voice failure never breaks text chat | M | Health gating; the module's iron rule |
| Commercial-safe default engine (VITS) | White-label clients aren't exposed to CPML | S | XTTS-v2 strictly opt-in + license ack |

### SHOULD Have
| Feature | User Value | Complexity | Notes |
|---|---|---|---|
| Auto-speak replies (per-bot toggle) | Voice-first feel without hands-free mode | M | Safari autoplay unlock required |
| Per-language voice picker in admin | Brand-fit voices per market | M | Catalog from sidecar `/voices` |
| TTS disk cache | Faster repeats, less CPU | S | Keyed on bot/voice/lang/text hash |
| messageId-verified TTS | Only persisted bot replies are synthesized | M | Abuse-surface reduction |

### COULD Have
| Feature | Notes |
|---|---|
| Streaming sentence-level TTS | Lower first-audio latency on long replies |
| Voice-interrupt barge-in (full duplex) | Requires echo cancellation confidence |
| Typed-message language detection | MVP covers via fixed per-bot language |

### WON'T Have (This Release)
| Feature | Reason for Exclusion | Reconsider When |
|---|---|---|
| XTTS-v2 as default | CPML weights are non-commercial-only; Coqui defunct so no license path; 10–30s/reply on CPU | A commercially-licensed multilingual model of similar quality appears |
| Voice cloning | Depends on XTTS; licensing + consent policy needed | XTTS decision revisited |
| Cloud STT/TTS providers | Contradicts self-hosted/no-fee positioning | Operator demand for managed option |
| Phone/telephony channel | Different product surface | Voice module proves demand |

## User Stories

### US-001: Ask by voice (push-to-talk) — MUST
**As** Priya, **I want to** tap a mic, speak, and see my words in the input box **so that** I can ask without typing.
- Happy: Given voice is enabled and mic permission granted, when I tap the mic, speak, and tap stop, then my transcript appears in the input within 3s, editable, and Send submits it.
- Edge: permission denied → mic shows blocked state with guidance, input still works. Silence → "didn't catch that", no message sent. Sidecar down → mic hidden entirely.
- Out of scope: auto-send of transcript (that's hands-free mode).

### US-002: Hear a reply — MUST
**As** Sam, **I want to** press play on any bot reply **so that** I can listen instead of reading.
- Happy: Given TTS is enabled, when a reply settles, a labeled speaker button appears; pressing it plays audio within 2s; pressing again stops it.
- Edge: reply language has no voice → muted "Audio isn't available in this language" notice, no error. Starting a new recording or sending stops playback.

### US-003: Hands-free conversation — MUST
**As** Priya, **I want** a voice mode where I talk and the bot talks back **so that** the whole exchange is spoken.
- Happy: Given hands-free is enabled for the bot, when I enter voice mode, the mic listens; after ~1.2s of silence my words are transcribed and sent; the reply streams as captions and is spoken; the mic re-arms after playback.
- Edge: tap = interrupt playback; X = exit to text chat with transcript preserved; two consecutive empty transcripts → drop to push-to-talk with a hint; mic is off while the bot speaks (half-duplex).

### US-004: Reply in my language — MUST
**As** Priya, **I want** the bot to answer in the language I spoke **so that** I understand it.
- Happy: Given I speak German with detection confidence ≥ 0.6, then the reply text and its audio are German.
- Edge: confidence < 0.6 → no language steering. TTS unsupported for that language → text reply in-language + audio-unavailable notice.

### US-005: Admin enables and configures voice — MUST
**As** Dana, **I want** per-bot voice toggles and voice pickers **so that** each client gets the right setup.
- Happy: Voice card in bot settings: master toggle (default off), STT/TTS/auto-speak/hands-free switches, default language, per-language voice selects; saving persists via existing PATCH.
- Edge: sidecar offline → card shows status banner with the start command; toggles still saveable. Existing bots after migration → voice off.

### US-006: Auto-speak replies — SHOULD
Dana can enable auto-speak so replies play when they settle. Done when: replies auto-play after a prior user gesture in the panel; when the browser blocks autoplay, the play button appears instead, silently.

## Key User Flow (hands-free)

```
┌────────────────────────────────────────────┐
│  ⌂ Bot name                     ⋯    ✕     │
│                                            │
│            ╭─────────────╮                 │
│            │   ● ● ●     │   state orb     │
│            │  Listening  │                 │
│            ╰─────────────╯                 │
│                                            │
│   "how do i reset my password"             │  live caption
│                                            │
│   [ tap orb to interrupt · ✕ exit voice ]  │
└────────────────────────────────────────────┘
Listening → (1.2s silence) → Transcribing → auto-send
→ Thinking (reply streams as captions) → Speaking 🔊 → re-arm → Listening
```
Exits at every state: tap orb (interrupt), ✕ (back to text chat, log preserved).

## Success Metrics

### Primary
| Metric | Target | How measured |
|---|---|---|
| Voice turn completion rate (mic press → message sent) | ≥ 80% | Widget events |
| STT round-trip latency (stop → transcript) | < 3s p75 | `/api/stt` timing |
| TTS start latency (press → audio) | < 2s p75 | `/api/tts` timing |

### Secondary
| Metric | Target | Why |
|---|---|---|
| Transcript edit rate before send | < 30% | Proxy for STT quality |
| Hands-free sessions completing ≥ 2 turns | ≥ 50% | Loop actually works |
| Text-chat error rate delta after launch | 0 | The never-break invariant |

### Not optimizing for (yet)
Session length or engagement time — this is support; shorter is better.

## Security Considerations Summary
| ID | Category | Consideration | Owner |
|---|---|---|---|
| SEC-PM-001 | data_protection | Voice audio is transient: buffered for transcription only, never persisted server-side | architect |
| SEC-PM-002 | abuse | `/api/stt`, `/api/tts` are public (botKey-only, consistent with app) but CPU-expensive → caps, semaphore, per-bot token bucket | architect |
| SEC-PM-003 | compliance | XTTS-v2 CPML = non-commercial only; must be impossible to enable accidentally | architect |
| SEC-PM-004 | privacy | Mic permission is delegated into a cross-origin iframe; customer page consent UX must be honest | designer |

## Open Questions
| Question | Impact | Owner | Status |
|---|---|---|---|
| Hindi VITS (fairseq) quality acceptable? | Hindi TTS may defer to Phase E / XTTS-only | Phase B spike | open |
| Hands-free latency budget achievable on CPU-only host? | May need smaller Whisper model or GPU note in docs | Phase B spike | open |

## Appendix: Competitive Scan (abridged)
- **Intercom Fin Voice / Zendesk AI agents** — polished cloud voice, per-resolution pricing, zero self-hosting; SupportKit differentiates on self-hosted + no per-minute fees.
- **Voiceflow** — voice-agent builder, strong tooling, but a platform to build on, not an embeddable white-label support widget.
- **Browser Web Speech API widgets** — free but inconsistent (Chrome routes audio to Google; Safari gaps), unusable for a privacy-positioned white-label product.
- Positioning: *the only white-label support widget where voice runs entirely on the operator's own hardware.*
