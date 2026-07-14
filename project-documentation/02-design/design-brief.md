---
document_type: design_brief
version: "1.0.0"
status: approved
created_by: ux_designer
project: "supportkit-voice-module"
depends_on:
  - document: "01-requirements/product-requirements.md"
    version: ">=1.0.0"
date: 2026-07-13
---

# Design Brief: SupportKit Voice Module

Register: **product UI** — the widget serves a task; earned familiarity over novelty. Everything lives inside the existing dark-only widget theme (HSL tokens in `app/globals.css`, per-bot `--primary`), Geist type, Tailwind **v3 syntax only** (v4-only classes silently fail to compile), lucide icons, framer-motion for state transitions.

## Design Principles

### 1. Voice is an accelerator, not a mode trap
**What it means**: every voice state has a one-tap exit back to working text input.
**Why**: Priya abandons after one bad turn; Sam cannot afford focus traps.
**In practice**: recording bar has Cancel; voice-mode overlay has a persistent ✕; blocked mic collapses to plain composer.

### 2. Show what the system hears
**What it means**: listening / transcribing / thinking / speaking are always visibly distinct states.
**Why**: voice UIs fail silently; visible state is the only trust signal (Doherty: acknowledge within 100ms).
**In practice**: recording bar appears instantly on tap with a level-driven pulse; "Transcribing…" uses the existing shimmer; the orb animates per state.

### 3. Editable before send
**What it means**: push-to-talk transcripts land in the input box, focused, for correction.
**Why**: STT errors are inevitable; edit-then-send keeps the user in control (hands-free intentionally trades this for flow).

### 4. Never dead-end
**What it means**: permission-blocked, sidecar-down, unsupported-language, autoplay-blocked all resolve to functioning text chat with an honest one-liner.

## Information Architecture

```
Chat panel (existing)
├── Header  ─ adds: hands-free toggle (Headphones icon) when handsfree_enabled
├── Message log ─ Bubble gains speaker button (settled assistant msgs, TTS on)
├── Composer ─ adds: Mic button between Input and Send (STT on)
│    ├── state: recording bar (replaces input row): pulse ● + timer + Cancel + Stop
│    └── state: transcribing (input disabled, shimmer placeholder)
└── Voice-mode overlay (hands-free) — covers panel body, header stays
     ├── State orb (Listening / Transcribing / Thinking / Speaking)
     ├── Live caption line (user transcript, then streaming reply)
     └── Controls: tap orb = interrupt · ✕ = exit to text
Admin (existing settings page)
└── "Voice" Card — master toggle, STT/TTS/auto-speak/hands-free switches,
    default language select, per-language voice selects, sidecar status banner
```

Navigation model: no new screens — voice is layered onto the existing panel (Jakob's law: mic-in-composer is the WhatsApp/iMessage convention; headphone toggle for voice mode matches ChatGPT/Gemini apps).

## User Flows

### Flow V1 — Ask by voice (push-to-talk)
Trigger: tap Mic. Actor: Priya/Sam.
1. Tap Mic → `requesting-permission` (browser prompt; button shows subtle spinner ≤100ms feedback)
2. Granted → `recording`: input row swaps to recording bar (pulsing dot driven by actual input level, mm:ss timer, Cancel, Stop). Auto-stop at 60s.
3. Stop → `transcribing`: shimmer in input, mic disabled.
4. Transcript → input field, focused, caret at end; detected language stored.
5. User edits (optional) → Send. `send()` stops any playback (barge-in).
- Errors: `NotAllowedError` → persistent blocked chip w/ tooltip ("Microphone is blocked — allow it in your browser settings"; iframe variant: "…the site embedding this chat must allow microphone access"); STT 503 → toast-style inline error, text path unaffected; empty transcript → placeholder flashes "Didn't catch that — try again or type".

### Flow V2 — Hands-free conversation
Trigger: Headphones toggle in header. Entry states from V1 permission flow.
```
[Listening ●●●] ─1.2s silence→ [Transcribing…] ─auto-send→
[Thinking (reply streams as caption)] → [Speaking 🔊] ─ends→ re-arm [Listening]
```
- Half-duplex: mic tracks disabled while Speaking (echo strategy).
- Tap orb: during Speaking = interrupt → Listening; during Listening = force-stop/submit.
- ✕ exits to text chat; full exchange already in the message log (log is the source of truth; overlay is a lens).
- Two consecutive empty transcripts → exit to composer with hint text (graceful de-escalation to V1).

### Flow V3 — Voice unavailable (fallback)
Sidecar down / feature-detect fails / global off → no voice affordances render at all (not disabled buttons — absent; Hick's law, zero dead chrome). Health probe runs once per panel mount.

## Screen/Component Inventory

| Component | States | Notes |
|---|---|---|
| `MicButton` (composer) | idle · requesting · recording(hidden) · transcribing(spinner) · blocked | ≥44×44 hit area (p-2 + -m-2 padding trick if needed); `aria-pressed`, `aria-label="Ask by voice"` |
| `RecordingBar` | recording | replaces input row; pulse dot (level-driven scale), timer, Cancel (ghost), Stop (primary, capsule) |
| `SpeakerButton` (Bubble) | idle(Volume2) · loading(spinner) · playing(Square) | only on settled assistant bubbles; `aria-label="Play reply aloud"` / "Stop audio" |
| `LanguageNotice` | one state | muted single line under bubble: "Audio isn't available in this language" |
| `VoiceModeOverlay` | listening · transcribing · thinking · speaking · error | orb + caption + exit; focus-trapped while open, Esc exits |
| `StateOrb` | 4 states | 96px circle in `--primary`; listening = 3-dot level pulse; transcribing = shimmer ring; thinking = slow rotate; speaking = radiating rings |
| Admin `VoiceCard` | ok · sidecar-offline | shadcn Card matching Branding/Model cards; banner: "Voice service offline — start it with `npm run dev:voice`" |

## Key Interactions (timing per ux-interaction-patterns)

| Interaction | Spec |
|---|---|
| Mic tap → recording bar | swap ≤100ms, 150ms ease-out crossfade; pulse animates from `AnalyserNode` RMS (never a fake loop) |
| Recording pulse | scale 1→1.25 with level, 100ms ease-out; `prefers-reduced-motion`: opacity only |
| Transcribing | existing widget shimmer CSS reused |
| Speaker press → audio | target <2s; loading spinner in-button (an inline <48px case); button swaps to Stop on play |
| Orb state changes | 200-250ms crossfade; reduced-motion: instant swap with label change |
| Barge-in | any new recording/send stops audio in <100ms (single shared player) |
| Auto-speak | plays only after ≥1 user gesture in panel (autoplay unlock); rejection ⇒ silently degrade to SpeakerButton |

Accessibility: WCAG AA. All buttons labeled; state changes announced via `role="status"` (polite); **known tension**: message log is `aria-live="polite"` — auto-speak + screen reader = double narration → autoplay is opt-in per bot, documented for operators; voice-mode overlay uses `aria-modal`, focus trap, Esc-to-exit; all animation has reduced-motion variants; contrast: reuse existing token pairs (already AA on dark).

## Engagement loop (Hook model — facilitator framing)
Trigger: mic affordance in composer (external). Action: tap-and-talk — lower ability cost than typing (Fogg). Reward: the answer itself, spoken; quality of resolution is the reward, not gamification. Investment: detected language + conversation continuity improve the next turn. Deliberately no streaks, badges, or re-engagement notifications — support UX optimizes for *fewer*, shorter sessions.

## Design Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hands-free latency (CPU STT+LLM+TTS) feels sluggish | Medium | High | Captions stream immediately (Thinking state is honest); spike validates budgets; Whisper `small` |
| Echo loop in hands-free | Medium | High | Half-duplex + `echoCancellation:true`; tap-interrupt not voice-interrupt |
| Safari autoplay blocks auto-speak | High | Medium | Gesture unlock + silent downgrade |
| Mic UI in tiny widget feels cramped | Low | Medium | Recording bar replaces (not squeezes) the input row |
