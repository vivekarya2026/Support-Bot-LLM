---
document_type: product_design_spec
version: "1.0.0"
status: approved-for-build
created_by: claude (product-development-pipeline + user-journey + patterns-flow-mapping + ui-ux-futuristic-designer + apple-hig-designer + ux-interaction-patterns + hooked-ux + cm-continuity)
project: "supportkit"
supersedes-scope: extends ux-redesign-spec.md (widget-level spec remains authoritative for widget interactions)
date: 2026-07-11
---

# SupportKit — White-Label Multi-Workspace Chatbot Platform

> Condensed single-run of the design pipeline (PM → Journeys → Flows → Visual → Interaction → Hook).
> Human checkpoints already resolved via approved plan: brand = **SupportKit** ("by Vivek Arya"),
> multi-workspace (no auth), design + implement, all 12 widget bugs fixed.
> Working memory: `.cm/CONTINUITY.md`.

---

## Stage 1 · Product framing (PM)

**Positioning.** SupportKit is a local-first, white-label support-chatbot kit. One running
instance hosts many isolated **bot workspaces**; each bot has its own knowledge base, prompt
library, branding, conversations, and embed snippet. The platform brand (SupportKit) is invisible
to end customers — every visitor-facing surface carries the *bot's* branding.

**Problem.** Today the prototype serves exactly one hardcoded brand (AgentPay). Anyone wanting
their own bot must edit source code in six files, has no way to manage prompts beyond one settings
textarea, cannot wipe and re-feed the knowledge base from the UI, and cannot embed the bot anywhere.

**Owner personas (onboarding must serve all four):**

| Persona | Digital literacy | KB source | Prompt need | Peak anxiety |
|---|---|---|---|---|
| **Sana, SaaS founder** | High | Product docs + pricing pages (URLs) | "Sound like our brand, deflect support" | "Will it say something wrong to a customer?" |
| **Deven, dev-tool PM** | Very high | Markdown docs repo (files) | Precise, citation-heavy, technical | "Will it hallucinate API params?" |
| **Ines, internal-helpdesk lead** | Medium | Policy PDFs / DOCX | Friendly, procedural, escalates to IT | "Can I start over if I mess up the upload?" |
| **Paulo, personal-site creator** | Medium-low | A few pages about himself | Casual, personal voice | "Is this going to be complicated?" |

**User stories (MoSCoW):**

| Pri | Story | Traces to |
|---|---|---|
| MUST | As an owner, I complete a first-run wizard and get a working, branded bot in <5 min | All personas; Fogg B=MAT |
| MUST | As an owner, I feed the KB by file upload or URL, per bot, and delete single docs | Sana (URLs), Deven (files), Ines (PDF) |
| MUST | As an owner, I can wipe a bot's KB entirely ("start fresh") with a typed confirmation | Ines's anxiety; recoverability |
| MUST | As an owner, I keep several named system prompts per bot, edit them, and switch which one is active | Prompt iteration without loss |
| MUST | As an owner, I set bot name, greeting, quick-starts, placeholder, and brand color per bot | White-label core |
| MUST | As an owner, I get a copy-paste embed snippet + shareable chat link per bot | Distribution |
| MUST | Visitors never see "SupportKit" branding inside the widget (only optional "Powered by" on the share page) | White-label promise |
| SHOULD | As an owner, I switch between workspaces without losing my place (same subpage) | Multi-bot operators |
| SHOULD | As an owner, I start a new prompt from a persona template gallery | Paulo (low literacy) |
| SHOULD | As an owner, I re-crawl a URL doc when the source page changes | Sana |
| COULD | Per-bot model override | Deven |
| WON'T (v1) | Auth/accounts, hosted multi-tenant, analytics dashboards, live-agent handoff | Scope |

**Success metrics.** Wizard completion rate (start→step ⑥); time-to-first-answered-question
< 5 min; % of bots with ≥2 prompts (library adoption); KB reset usage without support requests
(recoverability works); zero cross-bot citation leaks (isolation).

---

## Stage 2 · Owner journey maps (condensed, 5-phase)

**Sana (SaaS founder)** — 認知→検討→初回利用→習慣化→推薦 condensed:

| Phase | Doing | Thinking / feeling | Touchpoint | Opportunity → build |
|---|---|---|---|---|
| Discover | Clones/deploys SupportKit | "Another chatbot kit?" 😐 | README, landing | README pitch = 3 bullet outcomes, not stack details |
| Evaluate | Opens `/` first time | "Show me, don't tell me" 🤨 | First-run redirect | Zero-bot state jumps straight into wizard — no empty dashboard |
| First use | Wizard ①–⑥ | "That was… it?" 😀 peak | Wizard step ⑤ test chat | **Peak moment = her own docs answering in her brand color** |
| Habit | Checks conversations weekly | "What are users asking?" 🙂 | Dashboard "recent conversations" | New-conversation count on workspace card (hook trigger) |
| Refer | Sends `/chat/[slug]` link to cofounder | "Look what I made" 😄 | Share page | Share link visible on Done screen AND bot settings |

**Deven (dev-tool PM):** same skeleton; deltas — evaluates by uploading a real `.md` folder
(needs multi-file upload — already supported), inspects citations in test chat (step ⑤ must show
citation chips), habit loop = prompt iteration (edits prompt after reading a bad transcript →
prompt library edit-in-place with `updated_at` proof).

**Paulo (personal-site creator):** deltas — template gallery is his path (never writes a prompt
from scratch); URL ingestion of his own site is his KB path; embed snippet must be truly
copy-paste (one `<script>` tag, zero config); danger of drop-off at step ② (API key) → step ②
explains "one key powers all your bots" with a direct link to get one.

**Journey-derived rules:**
1. The wizard's peak is **step ⑤ (test chat)** — everything before it is friction to minimize.
2. Step ② (API key) is the highest-anxiety step for low-literacy personas → collapse it entirely
   when a key already exists ("Provider connected ✓").
3. Every phase ends pointing forward (peak-end): Done screen = share link + embed + dashboard CTA.

---

## Stage 3 · Flow map (screens, navigation, validation)

**Screen inventory (target state):**

| ID | Type | Route | Notes |
|---|---|---|---|
| S01 | Landing | `/` | SupportKit product landing + workspace grid; redirects → S10 when 0 bots |
| S02 | Hub | `/admin` | Workspace index (bot cards + stats); redirects → S10 when 0 bots |
| S03 | Utility | `/admin/settings` | Global: provider, key, default model, Tavily |
| S10 | Task | `/onboarding` | Wizard ①–⑥ ("New workspace" re-enters here) |
| S20 | Hub | `/admin/[slug]` | Bot dashboard (stats + recent conversations) |
| S21 | Utility | `/admin/[slug]/settings` | Branding + embed/share + danger-zone slot |
| S22 | Task | `/admin/[slug]/prompts` | Prompt library |
| S23 | Task | `/admin/[slug]/docs` | Knowledge base (+ danger zone) |
| S24 | Task | `/admin/[slug]/social` | Social listening (per-bot) |
| S25 | Detail | `/admin/[slug]/conversations` (+`/[id]`) | Transcripts |
| S26 | Task | `/admin/[slug]/support` | Escalations queue |
| S30 | Detail | `/chat/[slug]` | Public share page (bot-branded) |
| S31 | Overlay | `/embed/[botKey]` | Iframe surface (widget, embedded mode) |
| W | Overlay | ChatWidget | Turn state machine per ux-redesign-spec.md (authoritative) |

**Navigation map (admin):** persistent sidebar under `[slug]`: switcher (top) → Dashboard,
Settings, Prompts, Knowledge Base, Social, Conversations, Support → footer: View live (S30),
All workspaces (S02). S02 ↔ S20 via bot cards; S03 reachable from S02 and sidebar footer.
Switcher preserves the current subpage across bots (lateral transition, slug swap).

**Onboarding journey (goal: working branded bot):**
Start S01/S02 (0 bots, auto-redirect) or "New workspace" → S10
① Name + color (POST creates bot — decision: template persona also picked here feeds ④)
② Provider key (conditional: skipped-as-collapsed when configured)
③ Feed KB (files | URL | skip — skip allowed, KB is editable later)
④ Prompt (template gallery, editable preview, activates on continue)
⑤ Test chat (live widget, embedded) — **peak**
⑥ Done (share link, embed snippet, "Go to dashboard" → S20)
Failure paths: upload error → inline alert + retry, wizard never blocks; abandon after ① →
valid bot exists in S02 (no orphan state); step ② error (bad key) → inline validation, link to
provider console.

**Flow validation (design-time):**
- Dead ends: none — S30/S31 terminate externally by design (visitor surfaces); Done screen exits to S20.
- Orphans: none — every screen has ≥1 entry from the nav graph.
- Circular trap check: S10 abandon → S02 shows the partial bot (escape exists).
- Missing-state checklist per screen: loading = skeleton (docs table, conversations, prompts);
  empty = purposeful CTAs ("No documents yet — feed your bot" → upload card focus); error =
  inline alert + retry. Destructive actions (doc delete, KB reset, bot delete, prompt delete)
  all have confirmation; KB reset and bot delete require **typed confirmation** (slug).

---

## Stage 4 · Visual system (futuristic 2026 × Apple HIG)

Extends the token table in ux-redesign-spec.md (authoritative for the widget). Admin/wizard deltas:

| Token | Value | Usage |
|---|---|---|
| Surface glass | `rgba(255,255,255,0.08)` + `backdrop-blur(12px) saturate(180%)`, 1px border `rgba(255,255,255,0.12)` | Workspace cards, wizard card, prompt cards |
| Elevation L1 / L2 / L4 | existing shadow ramp | cards / dialogs / widget panel |
| Accent | per-bot `--primary` HSL triple (default `217 91% 60%`) | Widget + previews only; **admin chrome keeps default accent** (bot color must not restyle the console) |
| Danger | `--destructive` red; danger-zone card gets 1px destructive/30 border, never filled red | Danger zones |
| Radius | 20px panel / 16px cards / concentric inner = outer − padding | HIG concentric rule |
| Type ramp | 28px page title / 20px section / 15–17px body / 12–13px caption (never 10–11px) | Admin + wizard |
| Hit areas | ≥44×44pt all interactive elements (visual compact via padding) | Everything |
| Motion | 100–150ms micro / 200–300ms reveal / 300ms step transition; enter ease-out, exit ease-in; reduced-motion → fades | Everything |

Component specs (new):
- **Workspace card** (S02): glass card, bot-color dot + name + slug, 3 inline stats (docs / convos /
  new support), new-support badge (red 18px oval) when >0; hover lift −2px + shadow grow; whole
  card is the click target (≥44pt).
- **Wizard stepper**: 6 dots + labels, current = filled accent, done = check; step content slides
  16px + fades (300ms ease-out); back always available except during ① POST.
- **Prompt card**: name, `updated_at` ("Updated 2h ago"), Active badge (accent pill); actions
  right-aligned; Active card gets accent/40 border.
- **Danger zone**: separated by 32px + section label "Danger zone" in destructive color;
  actions are outline-destructive buttons; typed-confirm dialog: monospace slug echo, confirm
  button disabled until exact match, destructive fill only on the final button.
- **Embed snippet block**: monospace, one-line, copy button with success check animation (600ms
  draw) — peak-end on the Done screen.

---

## Stage 5 · Interaction patterns (micro)

| Moment | Pattern | Spec |
|---|---|---|
| Any async > 300ms | Skeleton, never full-page spinner | Docs table: 4 shimmer rows 48px; conversations list same; prompt list 3 cards |
| Prompt activate | **Optimistic UI** | Badge moves instantly; PATCH in background; revert + destructive toast on failure |
| Doc upload | Determinate-ish progress | Per-file row with indeterminate bar → success check draw / inline error + retry; input stays enabled (parallel uploads queue) |
| KB reset / bot delete | Typed-confirm | Input compares against slug; confirm disabled until match; on success: toast + counts ("Removed 12 documents, 87 chunks") |
| Wizard step change | Slide 16px + fade 300ms ease-out; reduced-motion → fade 150ms | Focus moves to step heading (a11y) |
| Copy embed/share | Button label → "Copied ✓" 1.5s, check draw animation | Peak-end |
| Save settings | Button loading state (spinner-in-button <48px allowed), width locked | Doherty <400ms ack |
| Toasts | sonner; success auto-dismiss 4s; errors persist with action | Errors never auto-dismiss (fixes design-debt from bug audit) |

Hard rules: no raw `ms` values (use tokens), no full-page loaders, destructive buttons
physically distant from primary actions, max 7 sidebar items (we have exactly 7), enter/exit
easing asymmetry, `prefers-reduced-motion` replaces movement with fades (never removes feedback).

---

## Stage 6 · Hook model — owner-side loop (ethics: Facilitator quadrant)

Widget-side loop already specced (ux-redesign-spec.md Stage 4, path to 8/10). Owner-side:

- **Trigger.** External: new-support badge + new-conversation counts on workspace cards (S02) and
  dashboard (S20). Internal target: "I wonder what users asked today" → open admin. No emails, no
  push, no manufactured urgency.
- **Action.** One click from card → recent conversations. Reading a transcript is the <60s core action.
- **Variable reward.** The hunt: real user questions are inherently variable; transcripts show
  whether citations landed. Competence signal: dashboard stat deltas.
- **Investment.** Every transcript read suggests the next investment: weak answer → "Edit prompt"
  / missing doc → "Add to knowledge base". Each investment measurably improves the next
  conversation (stored value = KB + prompt library). Investment loads the next trigger: better
  answers → more visitor questions → more transcripts.
- **Ethics check.** Maker uses it; materially improves owner's support workflow → Facilitator.
  No streaks, no FOMO, no dark patterns; data stays local (SQLite); owner can export/delete everything.
  Habit-zone honesty: weekly-frequency product — we optimize usefulness per visit, not visit count.

---

## Build traceability

| Spec section | Implementation phase (approved plan) |
|---|---|
| Stage 1 stories | Phases 1–8 |
| Stage 2 journey rules 1–3 | Phase 8 (wizard), Phase 3 (empty states) |
| Stage 3 screens/flows | Phases 3, 7, 8 |
| Stage 4 tokens/components | Phases 3–8 (shared CSS in globals.css) |
| Stage 5 patterns | Phases 3–8 |
| Stage 6 hook | Phase 3 (cards/badges), Phase 7 (share) |
| Widget spec (ux-redesign-spec.md) | Phase 6 |
