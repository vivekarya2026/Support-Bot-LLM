---
document_type: ux_redesign_spec
version: "1.0.0"
status: draft
created_by: claude (laws-of-ux + ui-ux-futuristic-designer + apple-hig-designer + product-development-pipeline + hooked-ux)
project: "agentpay-support-widget"
scope: MVP
date: 2026-07-11
---

# AgentPay Support Widget — Bug Audit & UX Flow Redesign

> Condensed single-run of the product-development pipeline (PM → Designer → Architect notes).
> Checkpoints that normally pause for human review are flagged as **Assumptions** instead.
> .docx export skipped (right-sized for MVP); generate on request.

---

## Part 1 — Bug audit

### Critical (breaks the core flow)

**BUG-01 · Escalation gate fires on every reply — `components/chat-widget.tsx:219-221`**
`if (userCount >= 2) return true;` means "Still need help? Talk to a person" renders under
*every* assistant reply from the user's 2nd message onward, forever — even when the bot answered
perfectly. It also makes rule (c) (RAG-miss on a substantive question, lines 222-228) dead code
after the first exchange, since (a) short-circuits first. The comment on `FRUSTRATION_RE`
(lines 25-27) says intent-matching "overrid[es] the 2+ messages volume gate" — i.e. the volume
gate was meant to be the *high* bar, but as written it is the lowest. Design intent ≠ implementation.
**Fix:** show escalation only on (b) frustration/intent match, (c) RAG-miss on a substantive
question, or (a′) 2 *consecutive* zero-citation replies / ≥4 user turns. Keep a quiet, always-available
"Contact support" affordance in the header so users are never trapped (see redesign).

**BUG-02 · Scroll hijacking during streaming — `components/chat-widget.tsx:51-55`**
The effect scrolls to bottom on every `messages` change — which is every streamed token — with no
"is the user already at the bottom?" check. Scrolling up to re-read while a long answer streams
yanks the user back down repeatedly.
**Fix:** track `isPinnedToBottom` (scrollTop + clientHeight ≥ scrollHeight − threshold on `scroll`
events); only auto-scroll when pinned; show a "↓ New reply" pill when unpinned content arrives.

**BUG-03 · Composer focus lost every turn — `components/chat-widget.tsx:495`**
`disabled={loading}` on the Input drops keyboard focus each time a message is sent; after every
reply the user must click the field again. It also blocks composing the next question while the
bot streams.
**Fix:** never disable the input; gate `send()` on `loading` (already does) and keep the send
button as the disabled affordance.

### High (data integrity / persistence)

**BUG-04 · Foreign keys never enforced — `lib/db.ts:14-16`**
better-sqlite3 does not enable `PRAGMA foreign_keys = ON` by default, so the schema's
`ON DELETE CASCADE` (messages, line 59) and `ON DELETE SET NULL` (support_requests, line 70)
never fire. `deleteConversation()` (`lib/conversations.ts:109-112`) orphans every message row;
support requests keep dangling conversation ids.
**Fix:** `db.pragma("foreign_keys = ON")` right after opening the database.

**BUG-05 · Assistant reply persisted twice on client disconnect — `app/api/chat/route.ts:192-200`**
Success path: `appendMessage(...)` then `controller.enqueue(done)`. If the client disconnected
(widget closed, tab navigated), `enqueue` throws → the `catch` block calls `appendMessage` again →
duplicate assistant row. The catch's own `enqueue` can then throw again, unhandled.
**Fix:** set a `persisted` flag before enqueueing `done`; wrap enqueues in try/catch or check
`req.signal.aborted`; stop consuming the upstream stream on abort.

### Medium (interaction correctness)

**BUG-06 · Enter sends the hovered suggestion, not the typed text — `chat-widget.tsx:429,452`**
`onMouseEnter` sets `highlightIdx`; form submit sends `suggestions[highlightIdx]` whenever
`highlightIdx >= 0`. A pointer resting over the dropdown hijacks a keyboard Enter.
**Fix:** per the WAI-ARIA combobox pattern, only keyboard navigation sets the *active* option;
hover styles are visual only.

**BUG-07 · Suggest effect churns per streamed token — `chat-widget.tsx:65-103`**
`messages` is in the dependency array, so the debounce effect tears down/re-runs on every delta,
calling `setSuggestions([])` (new array identity → extra renders). `forceTick` (lines 49, 175) is
redundant on top of `setMessages`.
**Fix:** depend on the trimmed input only; remove `forceTick`; read history via a ref at fire time.

**BUG-08 · Tab-complete reopens the dropdown — `chat-widget.tsx:479-485`**
Accepting a suggestion with Tab sets the input, which re-triggers the suggest effect 250 ms later
and pops the dropdown back over text the user already accepted.
**Fix:** suppress one suggest cycle after an accept (ref flag), or require the input to differ
from the last accepted value.

**BUG-09 · Accessibility gaps (HIG / WCAG AA)**
- Message log has no `aria-live="polite"` — screen readers never hear the bot's replies.
- Panel is `role="dialog"` without `aria-modal`, focus is not moved in on open, there is no focus
  trap, and Esc does not close it (`chat-widget.tsx:299-308`).
- Input lacks combobox semantics (`role="combobox"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant`); listbox options have no ids (`chat-widget.tsx:413-447`).
- Touch targets below 44 pt: suggestion rows ≈ 36 px, follow-up chips ≈ 26 px, citation toggle ≈ 16 px.
  Keep the compact visual, extend the hit area to ≥ 44 px.

**BUG-10 · Keyboard overlap on mobile — `chat-widget.tsx:305`**
`h-[60vh] max-h-[calc(100vh-7rem)]` uses `vh`; on iOS Safari the on-screen keyboard shrinks only
the *visual* viewport, so the composer can hide behind the keyboard. Use `dvh` (+ VisualViewport
fallback).

### Low (polish / quality)

**BUG-11 · Trailing blank line streamed before the follow-ups sentinel — `app/api/chat/route.ts:137-159`**
`forwardSafe` forwards text up to the sentinel index including the model's preceding `\n\n`;
bubbles render `whitespace-pre-wrap`, so users see a trailing blank line that the persisted copy
(trimmed by `stripFollowups`) doesn't have. Trim trailing whitespace when the sentinel is found.

**BUG-12 · Chunker never splits oversized paragraphs — `lib/documents.ts:15-35`**
A paragraph > 800 chars becomes one oversized chunk; the 100-char overlap tail can cut mid-word.
Split long paragraphs on sentence boundaries; snap overlap to whitespace. (Retrieval quality, not a crash.)

**Design-debt worth flagging (not bugs):** an LLM call per typing pause ≥ 3 chars (`/api/suggest`)
is a real cost/latency line item — consider serving typeahead from the local vector index instead;
error handling deletes the assistant bubble, auto-dismisses the toast in 5 s, and offers no retry.

---

## Part 2 — Redesign (condensed pipeline)

### Stage 1 · Product framing (PM)

**Problem.** Visitors evaluating AgentPay ask the widget questions mid-task. Today the flow
erodes trust in three ways: the bot begs to escalate after nearly every answer (BUG-01), the UI
steals scroll/focus control (BUG-02/03), and errors dead-end with no recovery. Result: users stop
asking (abandoned deflection) or escalate prematurely (support load).

**Persona (assumption — confirm).** *Deven, integration developer.* Technical comfort high; lands
on docs/marketing mid-evaluation; wants a verifiable answer in under a minute; distrusts chatbots
that can't cite sources. Peak frustration: being forced to email support for something the docs answer.

**MoSCoW for this redesign**

| Priority | Change | Traces to |
|---|---|---|
| MUST | Evidence-based escalation ladder (BUG-01 fix + header contact affordance) | Trust, deflection |
| MUST | Scroll anchoring + "new reply" pill (BUG-02) | User control |
| MUST | Persistent composer focus, type-while-streaming (BUG-03) | Task speed |
| MUST | Error recovery in-bubble (Retry keeps the failed turn) | Peak-end |
| MUST | A11y baseline: aria-live, dialog focus contract, combobox semantics, 44 pt hit areas (BUG-09) | HIG / WCAG AA |
| SHOULD | One-suggestion-surface rule (quick-starts / autocomplete / follow-ups never stack) | Hick's law |
| SHOULD | Conversation resume via localStorage (conversationId already exists) | Hooked investment |
| SHOULD | Escalation confirmation as peak moment (ticket #, expected reply time) | Peak-end |
| COULD | Vector-index typeahead instead of LLM autocomplete | Cost, latency |
| COULD | Feedback chips (👍/👎) per answer feeding admin analytics | Habit testing |
| WON'T (now) | Auth, multi-tenancy, live agent chat | Prototype scope — revisit at production |

**Success metrics.** Self-serve resolution ≥ 60 %; escalation CTR *when shown* ≥ 25 % (proves
timing is right — today it's shown so often CTR would read as noise); median first-token < 1.5 s;
% of sessions with ≥ 2 questions (habit signal); error-turn recovery rate (retries that succeed).

### Stage 2 · Flow redesign (UX)

**Design principles (opinionated):**
1. **The bot never begs.** Escalation appears only on evidence of failure; a quiet "Talk to a person"
   lives permanently in the header overflow so nobody is ever trapped.
2. **Show the work.** Citations are the trust surface — keep them one tap away, never hidden entirely.
3. **Never steal control.** The user owns scroll position, focus, and keyboard. The system may invite
   (pill, chip), never yank.
4. **One suggestion surface at a time.** Quick-starts (empty state) → autocomplete (while typing) →
   follow-ups (after an answer). Mutually exclusive, max 3 items each (Hick + Miller).
5. **End every turn forward.** Every assistant turn ends with either follow-ups, a citation, or a
   recovery action — never a dead end (peak-end rule).

**Escalation ladder (replaces the volume gate):**

```
Tier 0  always:   "Talk to a person" in header ··· quiet, discoverable, never inline noise
Tier 1  signals:  frustration regex match ─┐
                  RAG-miss on substantive ─┼─▶ inline EscalationLink under that reply only
                  2 consecutive misses    ─┘    (auto-hides if next answer lands with citations)
Tier 2  invoked:  inline sheet (HIG-style) with ONE required field (email, prefilled if known),
                  transcript auto-attached, message prefill collapsed under "Edit summary"
Tier 3  confirmed: peak moment — ticket id + "replies within N h" + bot stays available
```

**Turn state machine (after):**

```
closed → open(empty: greeting + 3 quick-starts)
       → composing (autocomplete after 250 ms, ≥3 chars, combobox pattern)
       → sending → streaming (typing dots → tokens; input stays enabled; scroll only if pinned)
       → answered ──▶ follow-ups (≤3) + citations disclosure
       │              └─ escalation link IFF Tier-1 signal
       ├─ error ────▶ bubble persists with inline "Retry" (failed text restored to composer)
       └─ escalate ─▶ sheet → confirmed note → loop continues
```

**Interaction specs (key ones):**
- *Scroll:* pin threshold 48 px; unpinned + new content ⇒ "↓ New reply" pill (44 pt), click re-pins.
- *Dialog:* open ⇒ focus moves to input; Esc closes (unless sheet open ⇒ closes sheet first);
  focus returns to launcher on close; `aria-modal="true"`.
- *Combobox:* ↑/↓ move active option (`aria-activedescendant`), Enter sends active *only if set
  by keyboard*, Tab accepts into input (suppresses next suggest cycle), Esc closes list.
- *Reduced motion:* all springs → opacity fades ≤ 150 ms (already partly handled — keep).

### Stage 3 · Visual system (futuristic 2026 × Apple HIG)

Keep the existing dark navy identity; formalize tokens:

| Token | Value | Notes |
|---|---|---|
| Surface glass | `rgba(255,255,255,0.08)` + `backdrop-blur(12px) saturate(180%)` | panel + dropdown only, solid fallback `hsl(222 14% 10%)` |
| Elevation (panel) | `0 12px 24px rgb(0 0 0/.18), 0 24px 48px rgb(0 0 0/.24)` | Level-4 floating |
| Accent | keep `hsl(217 91% 60%)` | AA on dark ground for ≥17 px text |
| Radius | outer 20 px panel, 16 px bubbles, concentric: inner = outer − padding | HIG concentric rule |
| Type | SF Pro / system stack; body 15–17 px, captions 12–13 px (up from 10–11 px) | 10 px labels fail legibility |
| Hit areas | ≥ 44 × 44 pt everywhere (visual can stay compact via padding/pseudo-element) | HIG minimum |
| Motion | 200–300 ms, `cubic-bezier(0.25,0.1,0.25,1)`; springs only on launcher | Apple easing |

Component deltas: launcher gains an unread badge (red 18 px oval) when a reply lands while closed;
header keeps status dot but adds overflow menu (Tier-0 contact + "Start over"); citation chips
become numbered inline pills `[1] pricing.md` (44 pt hit area) with popover preview.

### Stage 4 · Hook model audit

**Current score: 4/10.** Trigger: external only (pulsing dot, "look bottom-right"); no re-entry
trigger exists once the tab closes. Action: good (single field) but BUG-02/03 add friction
mid-loop. Variable reward: genuinely variable (answer quality, citations found = "hunt") but the
nagging escalation dilutes reward with doubt. Investment: none persists — refresh wipes the
conversation even though the server stores it.

**Path to 8/10 (ethical — facilitator quadrant):**
- *Trigger:* internal trigger = "confused about AgentPay → ask the widget." Support it: unread badge
  (external bridge), and the escalation email reply deep-links back to the conversation (loads the
  next trigger).
- *Action:* fix focus/scroll; keep first action < 60 s (quick-start chip = one tap).
- *Variable reward:* answer + sources found is the hunt reward; add a subtle "Answered from 3 docs
  in 1.2 s" meta-line (competence signal, varies per turn). No streaks, no manufactured FOMO — this
  is a utility.
- *Investment:* localStorage conversation resume ("Pick up where you left off"); every asked
  question improves admin's doc-gap analytics (visible in /admin) — investment loads the *owner's*
  loop too.
- *Ethics check:* no exploiting frustration (we respond to it with a human, we don't farm it);
  data leaves with the user (transcript attached to their email). Passes the Manipulation Matrix
  as Facilitator.

### Architect notes (delta only — stack unchanged)

Next.js + SQLite stack is right-sized; no changes. Implementation deltas: `db.pragma("foreign_keys = ON")`
(BUG-04); persistence flag + abort handling in the SSE route (BUG-05, BUG-11); optional
`GET /api/conversations/:id` for localStorage resume (messages already stored); typeahead COULD
swap `/api/suggest` LLM call for a `retrieve(partial, 3)` vector query — zero marginal cost.

### Open questions

| Question | Impact | Owner |
|---|---|---|
| Confirm persona: is the primary user a developer or a merchant/end-customer? | Tone of copy, quick-starts | user |
| Expected human reply SLA for the Tier-3 promise ("within N h") | Trust — never promise what support can't keep | user |
| Should conversation resume be opt-in (privacy on shared machines)? | localStorage design | user |
