# SupportKit

White-label support chatbots your customers can **type to or talk to** — by **Vivek Arya**.

One running SupportKit instance hosts any number of isolated **bot workspaces**. Each bot
has its own knowledge base (RAG with citations), its own library of system prompts (one
active at a time), its own branding (name, greeting, color, quick-starts), its own
**voice** (speech-to-text input + spoken replies, hands-free mode, multi-language), and
its own share page + embed snippet. The SupportKit brand never appears inside a bot's
widget. Everything — LLM calls excepted — runs on your own hardware: embeddings, vector
search, speech recognition, and speech synthesis are all local. No per-minute voice fees,
and no audio ever leaves your infrastructure.

## Quickstart

```bash
npm install
npm run dev            # text chat only
```

With voice (optional — needs Python 3.11 and espeak-ng):

```bash
brew install espeak-ng           # macOS; Debian/Ubuntu: apt install espeak-ng
bash voice-service/setup.sh      # creates the Python venv, installs pinned deps
voice-service/.venv/bin/python voice-service/scripts/warm.py   # pre-download models (~1 GB)
npm run dev:all                  # Next.js + voice sidecar together
```

Open http://localhost:3000 — with no bots yet, you land in the **onboarding wizard**:

1. **Name your bot** — name, brand color, and a persona (SaaS support, docs assistant,
   internal helpdesk, personal site, e-commerce).
2. **Connect a model** — one API key powers every workspace. Any OpenAI-compatible
   endpoint works (OpenRouter, OpenAI, Gemini, Groq, Together, LM Studio…). Skipped
   automatically once configured.
3. **Feed the knowledge base** — upload `.pdf` / `.docx` / `.md` / `.txt` or crawl a URL.
   Optional; add knowledge anytime later.
4. **Give it a voice** — review/edit the seeded system prompt.
5. **Try it** — a live test chat with your real knowledge and branding.
6. **Done** — copy the share link and embed snippet.

## Distributing a bot

- **Share page**: `http://localhost:3000/chat/<slug>` — full-page, bot-branded chat.
- **Embed anywhere**: paste one tag before `</body>` on any site:

  ```html
  <script src="http://localhost:3000/embed.js" data-bot-key="pk_…" async></script>
  ```

  A launcher appears bottom-right and toggles an iframe served by this instance. The
  `pk_…` key is the bot's public handle (shown in Bot Settings → Share & embed).

## Managing bots (`/admin`)

`/admin` lists your workspaces; each workspace gets a sidebar with:

- **Dashboard** — stats + recent conversations.
- **Bot Settings** — branding (name, greeting, intro, placeholder, quick-starts, color),
  model override, share/embed snippets, and the delete-workspace danger zone.
- **Prompts** — keep several named system prompts; exactly one is active. Create from
  persona templates or blank, edit in place, duplicate, activate instantly. The active
  prompt can't be deleted.
- **Knowledge Base** — upload files / crawl URLs, delete single documents, re-crawl URL
  documents, and **Start fresh** (typed-confirmation wipe of all documents + embeddings
  for that bot only).
- **Social Listening** — search Reddit / X / LinkedIn / HN for mentions (Tavily key
  required) and index useful threads into this bot's knowledge base.
- **Conversations / Support Requests** — transcripts and escalations.

**Global settings** (`/admin/settings`) hold what's shared across all bots: provider API
key, base URL, default model, and the optional Tavily key.

| Global | Per-bot |
|---|---|
| Provider API key, base URL | Name, slug, public key, greeting, intro, placeholder |
| Default model | Quick-starts, brand color, model override |
| Tavily key | Prompt library, knowledge base, conversations, support requests |

## How it works

- **Chat** (`app/api/chat/route.ts`): resolves the bot by public key, retrieves the top-4
  chunks from that bot's vector partition, builds the system message from the bot's
  active prompt, and streams SSE. Replies cite sources `[1]`, `[2]`….
- **RAG** (`lib/rag.ts`, `lib/db.ts`, `lib/embeddings.ts`): local MiniLM embeddings
  (384-dim, `@xenova/transformers`) in a `sqlite-vec` store (`data/vectors.db`).
  `chunk_vectors` uses a **`bot_id` partition key**, so cross-bot retrieval leakage is
  structurally impossible.
- **Widget** (`components/widget/`): fully config-driven (zero hardcoded branding),
  evidence-based escalation ladder ("Talk to a person" lives quietly in the header menu;
  inline offers appear only on frustration signals, citation misses, or long sessions),
  scroll pinning with a "New reply" pill, persistent composer focus, conversation resume
  via localStorage, combobox-pattern autocomplete, and WCAG-AA dialog/focus semantics.

## Voice: talk to the bot, hear it answer

Enable per bot in **Bot Settings → Voice** (off by default). What visitors get:

- **Push-to-talk** — a mic button in the composer; speak, review the transcript, send.
- **Spoken replies** — a play button on every answer (optionally auto-speak).
- **Hands-free conversation** — headphones toggle: speak → the bot answers aloud →
  the mic re-arms. Half-duplex (mic off while the bot speaks) with tap-to-interrupt.
- **Multi-language loop** — speech is auto-detected among ~100 languages; the bot
  replies (text *and* audio) in the language spoken. Ships tested with English, Hindi,
  Spanish, French, German (+ Italian & Portuguese voices).

How it's built: a loopback-only **Python sidecar** (`voice-service/`, FastAPI on
`127.0.0.1:8078`) runs **faster-whisper** for speech-to-text and a **TTS engine chain**
— **Kokoro-82M** (Apache-2.0, human-quality, CPU real-time) first, **Coqui VITS** as
fallback (covers German). Only the Next.js server talks to the sidecar; the widget goes
through `/api/stt`, `/api/tts`, and `/api/voice/health`, which validate the bot key and
enforce per-bot flags. If the sidecar is down, voice controls simply don't render — text
chat is never affected. Browser audio (Chrome webm/opus, Safari mp4/AAC) is decoded
directly; recorded audio is transcribed and discarded, never stored.

Voice licensing matters for white-label use — see the model license table in
[`voice-service/README.md`](voice-service/README.md) (short version: Kokoro and the code
are commercial-safe; XTTS-v2 and the fairseq Hindi voice are non-commercial and clearly
badged in the admin UI).

## Tech stack (exact)

| Layer | Technology |
|---|---|
| Framework | Next.js 15.0.3 (App Router, route handlers), React 19 RC, TypeScript |
| UI | Tailwind CSS 3.4, shadcn/ui on Radix primitives, framer-motion, lucide-react |
| LLM | Any OpenAI-compatible endpoint via the `openai` SDK (OpenRouter, OpenAI, Groq, LM Studio…) — streaming SSE |
| Embeddings | `@xenova/transformers` running MiniLM-L6-v2 locally (384-dim, no API) |
| Vector store | SQLite via `better-sqlite3` + `sqlite-vec` (vec0 virtual table with a `bot_id` **partition key**) |
| Speech-to-text | `faster-whisper` (CTranslate2, Whisper `small`, ~100 languages, auto-detect) |
| Text-to-speech | **Kokoro-82M** (Apache-2.0) + Coqui TTS (idiap fork, MPL-2.0) VITS fallback; engine-chain architecture, XTTS-v2 optional (license-gated) |
| Voice sidecar | Python 3.11, FastAPI + uvicorn, PyAV codecs, espeak-ng phonemes |
| Doc ingestion | pdf-parse, mammoth (docx), cheerio + turndown (URL crawl) |
| Optional | Tavily API (social listening) |

## Deploying

**Vercel (demo mode).** Import the repo at [vercel.com/new](https://vercel.com/new) —
it builds as a standard Next.js app. Two honest caveats:

1. **Data is ephemeral**: serverless filesystems are read-only, so SQLite lives in
   `/tmp` and resets on cold starts/redeploys. Fine for a demo, wrong for production.
2. **Voice is off**: the Python sidecar can't run inside Vercel functions. The widget
   detects this and hides voice controls automatically. (Optionally set
   `VOICE_SERVICE_URL` to a sidecar you host elsewhere over a private network.)

Set env vars in the Vercel project: `OPENROUTER_API_KEY` (required for chat),
`OPENROUTER_BASE_URL` (optional), `TAVILY_API_KEY` (optional), `VOICE_SERVICE_URL=`
(empty, to disable voice cleanly).

**Self-host (recommended for real use).** Any Node-capable VPS/machine with a
persistent disk: `npm run build && npm start` plus `bash voice-service/run.sh` (or a
process manager running both). This is the deployment the product is designed for —
persistent SQLite, working voice, no per-request fees. Don't expose `/admin` publicly
(there is deliberately no auth; front it with a reverse-proxy basic-auth if needed).

## Upgrading from the single-bot prototype

Existing `data/vectors.db` files migrate automatically on first boot (gated by
`PRAGMA user_version`): a `default` workspace is created carrying the old branding and
system prompt, all documents/conversations are assigned to it, and the vector table is
rebuilt with the partition key — no re-embedding. Back up first if you care:
`cp data/vectors.db data/vectors.db.bak`.

## Demo seed (optional)

```bash
npm run seed
```

Creates a `demo` workspace and indexes the sample docs in `docs/sample/`.

## Known limitations (intentional)

- No auth — this is a local-first tool; don't expose `/admin` to the public internet.
- No rate limiting.
- Embed iframes may have their localStorage partitioned by some browsers (conversation
  resume still works per-site).

## Product documentation

The voice module was built through a full product pipeline — the documents live in
[`project-documentation/`](project-documentation/):

- [**PRD**](project-documentation/01-requirements/product-requirements.md) — personas,
  MoSCoW prioritisation, user stories with acceptance criteria, success metrics,
  competitive scan (`01-requirements/product-requirements.md`).
- [**Design brief**](project-documentation/02-design/design-brief.md) — design
  principles, information architecture, user flows, component inventory, interaction
  timing specs, accessibility requirements.
- [**Technical architecture**](project-documentation/03-architecture/technical-architecture.md)
  — system diagram, data model, API contracts, security architecture, ADRs.
- [**Decision log**](project-documentation/_meta/decision-log.md) — every major
  decision with context, alternatives, and rationale (including the TTS licensing
  analysis).
- `project-documentation/supportkit-design-spec.md` — original product/UX spec
  (personas, journeys, flows, visual system).
- `project-documentation/ux-redesign-spec.md` — widget bug audit + interaction spec.
