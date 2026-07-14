"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { PROMPT_TEMPLATES } from "@/lib/prompt-templates";
import { ChatWidget } from "@/components/widget/chat-widget";
import { cn } from "@/lib/utils";
import type { WidgetConfig } from "@/components/widget/types";

type WizardBot = {
  id: number;
  slug: string;
  publicKey: string;
  name: string;
  greeting: string;
  intro: string;
  placeholder: string;
  primaryColor: string;
  quickStarts: string[];
  activePromptId: number | null;
};

const STEPS = ["Name", "Connect", "Knowledge", "Voice", "Try it", "Done"] as const;

const SWATCHES = [
  "217 91% 60%",
  "239 84% 67%",
  "258 90% 66%",
  "189 94% 43%",
  "160 84% 39%",
  "38 92% 50%",
  "347 77% 50%",
];

const SELECT_CLS =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function OnboardingWizard({
  providerConfigured,
  currentBaseUrl,
  currentModel,
}: {
  providerConfigured: boolean;
  currentBaseUrl: string;
  currentModel: string;
}) {
  const [step, setStep] = useState(0);
  const [bot, setBot] = useState<WizardBot | null>(null);
  const [keyConfigured, setKeyConfigured] = useState(providerConfigured);
  const reduce = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Moving between steps announces the new step to keyboard/AT users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <span className="text-sm font-semibold text-foreground">SupportKit</span>
          </div>
          <Link
            href="/admin"
            className="text-xs min-h-11 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip to admin
          </Link>
        </div>
      </header>

      {/* Stepper */}
      <nav aria-label="Setup progress" className="max-w-2xl w-full mx-auto px-6 pt-8">
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
              <span
                className={cn(
                  "size-7 rounded-full flex items-center justify-center text-xs font-medium ring-1 shrink-0 transition-colors",
                  i < step
                    ? "bg-primary text-primary-foreground ring-primary"
                    : i === step
                      ? "bg-primary/15 text-primary ring-primary/40"
                      : "bg-muted text-muted-foreground ring-border"
                )}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs hidden sm:inline",
                  i === step ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border hidden sm:block" />}
            </li>
          ))}
        </ol>
      </nav>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
            transition={{ duration: reduce ? 0.15 : 0.3, ease: "easeOut" }}
          >
            {step === 0 && (
              <StepName
                headingRef={headingRef}
                bot={bot}
                onCreated={(b) => {
                  setBot(b);
                  next();
                }}
              />
            )}
            {step === 1 && (
              <StepConnect
                headingRef={headingRef}
                configured={keyConfigured}
                currentBaseUrl={currentBaseUrl}
                currentModel={currentModel}
                onDone={(nowConfigured) => {
                  setKeyConfigured(nowConfigured);
                  next();
                }}
                onBack={back}
              />
            )}
            {step === 2 && bot && (
              <StepKnowledge headingRef={headingRef} bot={bot} onDone={next} onBack={back} />
            )}
            {step === 3 && bot && (
              <StepVoice headingRef={headingRef} bot={bot} onDone={next} onBack={back} />
            )}
            {step === 4 && bot && (
              <StepTest headingRef={headingRef} bot={bot} onDone={next} onBack={back} />
            )}
            {step === 5 && bot && <StepDone headingRef={headingRef} bot={bot} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function StepHeading({
  headingRef,
  title,
  sub,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  sub: string;
}) {
  return (
    <>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight text-foreground outline-none"
      >
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sub}</p>
    </>
  );
}

/* ---------- ① Name + color + persona ---------- */

function StepName({
  headingRef,
  bot,
  onCreated,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  bot: WizardBot | null;
  onCreated: (b: WizardBot) => void;
}) {
  const [name, setName] = useState(bot?.name ?? "");
  const [color, setColor] = useState(bot?.primaryColor ?? SWATCHES[0]);
  const [templateId, setTemplateId] = useState("saas-support");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    // Re-entering step ① after a bot exists just moves on (no duplicate bots).
    if (bot) {
      onCreated(bot);
      return;
    }
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, primaryColor: color, templateId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Failed: ${res.status}`);
      onCreated(j.bot as WizardBot);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={create}>
      <StepHeading
        headingRef={headingRef}
        title="Name your bot"
        sub="This is what visitors see in the chat header. You can change everything later."
      />
      <div className="mt-6 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="ob-name">Bot name</Label>
          <Input
            id="ob-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Assistant"
            required
            autoFocus
            disabled={!!bot}
            className="h-11"
          />
          {bot && (
            <p className="text-xs text-muted-foreground">
              Created as <span className="font-mono">/{bot.slug}</span> — rename later in Bot
              Settings.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Brand color</Label>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((hsl) => (
              <button
                key={hsl}
                type="button"
                onClick={() => setColor(hsl)}
                disabled={!!bot}
                className={cn(
                  "size-11 rounded-full ring-2 transition-transform hover:scale-110 disabled:opacity-60",
                  color === hsl ? "ring-foreground" : "ring-transparent"
                )}
                style={{ backgroundColor: `hsl(${hsl})` }}
                aria-label={`Brand color ${hsl}`}
                aria-pressed={color === hsl}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>What kind of bot is this?</Label>
          <p className="text-xs text-muted-foreground">
            Picks the starting voice, greeting, and quick-start questions — all editable.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {PROMPT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                disabled={!!bot}
                className={cn(
                  "text-left p-3.5 min-h-11 rounded-lg border transition-colors disabled:opacity-60",
                  templateId === t.id
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                )}
                aria-pressed={templateId === t.id}
              >
                <div className="text-sm font-medium text-foreground">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {err && <div className="text-xs text-destructive">{err}</div>}

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={creating || (!bot && !name.trim())} className="min-h-11">
            {creating ? "Creating…" : "Continue"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ---------- ② Provider connection (global) ---------- */

function StepConnect({
  headingRef,
  configured,
  currentBaseUrl,
  currentModel,
  onDone,
  onBack,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  configured: boolean;
  currentBaseUrl: string;
  currentModel: string;
  onDone: (configured: boolean) => void;
  onBack: () => void;
}) {
  const [providerId, setProviderId] = useState<ProviderId>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(currentBaseUrl || PROVIDERS[0].defaultBaseUrl);
  const [model, setModel] = useState(currentModel);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const provider = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];

  if (configured) {
    return (
      <div>
        <StepHeading
          headingRef={headingRef}
          title="Provider connected"
          sub="One key powers every workspace, and it's already set up."
        />
        <Card className="mt-6 border-success/30">
          <CardContent className="p-5 flex items-center gap-3">
            <CheckCircle2 className="size-5 text-success shrink-0" />
            <div className="text-sm text-foreground">
              LLM connection configured
              <div className="text-xs text-muted-foreground mt-0.5">
                Default model: <span className="font-mono">{currentModel || "(unset)"}</span> ·
                change anytime in{" "}
                <Link href="/admin/settings" className="text-primary hover:underline">
                  global settings
                </Link>
                .
              </div>
            </div>
          </CardContent>
        </Card>
        <WizardNav onBack={onBack} onNext={() => onDone(true)} />
      </div>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openrouter_api_key: apiKey,
          openrouter_base_url: baseUrl,
          default_model: model,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onDone(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <StepHeading
        headingRef={headingRef}
        title="Connect a model"
        sub="One API key powers all your bots. Any OpenAI-compatible provider works — OpenRouter gives you many models with a single key."
      />
      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Provider</Label>
          <select
            className={SELECT_CLS}
            value={providerId}
            onChange={(e) => {
              const id = e.target.value as ProviderId;
              setProviderId(id);
              const p = PROVIDERS.find((x) => x.id === id);
              if (p && p.id !== "custom") {
                setBaseUrl(p.defaultBaseUrl);
                if (p.fallbackModels[0]) setModel(p.fallbackModels[0].id);
              }
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>API key</Label>
          <p className="text-xs text-muted-foreground">
            {provider.keyRequired
              ? `Paste your ${provider.label} key.`
              : `Optional for ${provider.label}.`}{" "}
            Stored locally in your SQLite file, never sent anywhere else.
          </p>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider.keyHint}
            className="font-mono h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="font-mono h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Default model</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. anthropic/claude-sonnet-4.5"
            className="font-mono h-11"
          />
        </div>
        {err && <div className="text-xs text-destructive break-all">{err}</div>}
      </div>
      <WizardNav
        onBack={onBack}
        nextLabel={saving ? "Saving…" : "Save & continue"}
        nextDisabled={saving || (provider.keyRequired && !apiKey.trim())}
        submit
      />
    </form>
  );
}

/* ---------- ③ Feed the knowledge base ---------- */

function StepKnowledge({
  headingRef,
  bot,
  onDone,
  onBack,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  bot: WizardBot;
  onDone: () => void;
  onBack: () => void;
}) {
  const api = `/api/admin/bots/${bot.slug}/docs`;
  const [indexed, setIndexed] = useState<{ source: string; chunkCount: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList) {
    setBusy(true);
    setErr(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${api}/upload`, { method: "POST", body: form });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error ?? `Upload failed: ${res.status}`);
        setIndexed((prev) => [...prev, { source: j.source, chunkCount: j.chunkCount }]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function crawl() {
    if (!url.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${api}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Failed: ${res.status}`);
      setIndexed((prev) => [...prev, { source: j.source, chunkCount: j.chunkCount }]);
      setUrl("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <StepHeading
        headingRef={headingRef}
        title="Feed the knowledge base"
        sub="Whatever you add here is what the bot answers from — and it cites its sources. You can skip this and add knowledge later."
      />
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Upload className="size-4 text-primary" />
              Upload files
            </div>
            <p className="text-xs text-muted-foreground mt-1">.pdf, .docx, .md, .txt</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.md,.markdown,.txt"
              disabled={busy}
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              className="mt-3 block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:font-medium hover:file:bg-primary/90 file:cursor-pointer disabled:opacity-50"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <LinkIcon className="size-4 text-primary" />
              Crawl a URL
            </div>
            <p className="text-xs text-muted-foreground mt-1">Docs page, pricing page, FAQ…</p>
            <div className="mt-3 flex gap-2">
              <Input
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
                className="h-11"
              />
              <Button type="button" onClick={crawl} disabled={busy || !url.trim()} className="min-h-11">
                Crawl
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {indexed.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {indexed.map((d, i) => (
            <li
              key={d.source + i}
              className="flex items-center gap-2 text-xs text-foreground bg-success/10 border border-success/30 rounded-lg px-3 py-2"
            >
              <CheckCircle2 className="size-3.5 text-success shrink-0" />
              <span className="truncate">{d.source}</span>
              <span className="ml-auto text-muted-foreground shrink-0">
                {d.chunkCount} chunks
              </span>
            </li>
          ))}
        </ul>
      )}
      {err && <div className="mt-3 text-xs text-destructive break-all">{err}</div>}

      <WizardNav
        onBack={onBack}
        onNext={onDone}
        nextLabel={indexed.length > 0 ? "Continue" : "Skip for now"}
        nextDisabled={busy}
      />
    </div>
  );
}

/* ---------- ④ Voice (edit the seeded prompt) ---------- */

function StepVoice({
  headingRef,
  bot,
  onDone,
  onBack,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  bot: WizardBot;
  onDone: () => void;
  onBack: () => void;
}) {
  const api = `/api/admin/bots/${bot.slug}/prompts`;
  const [promptId, setPromptId] = useState<number | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [original, setOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(api)
      .then((r) => r.json())
      .then(
        (d: {
          prompts: { id: number; content: string }[];
          activePromptId: number | null;
        }) => {
          const active =
            d.prompts.find((p) => p.id === d.activePromptId) ?? d.prompts[0] ?? null;
          if (active) {
            setPromptId(active.id);
            setContent(active.content);
            setOriginal(active.content);
          } else {
            setContent("");
          }
        }
      );
  }, [api]);

  async function saveAndContinue() {
    if (promptId !== null && content !== null && content !== original) {
      setSaving(true);
      setErr(null);
      try {
        const res = await fetch(`${api}/${promptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error((await res.json())?.error ?? `Failed: ${res.status}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    onDone();
  }

  return (
    <div>
      <StepHeading
        headingRef={headingRef}
        title="Give it a voice"
        sub="This system prompt drives every answer. We seeded it from the persona you picked — tweak anything. You can keep multiple prompts later and switch instantly."
      />
      <div className="mt-6">
        {content === null ? (
          <div className="h-64 rounded-xl shimmer" aria-busy="true" aria-label="Loading prompt" />
        ) : (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            className="font-mono text-xs leading-relaxed"
            aria-label="System prompt"
          />
        )}
        {err && <div className="mt-2 text-xs text-destructive">{err}</div>}
      </div>
      <WizardNav
        onBack={onBack}
        onNext={saveAndContinue}
        nextLabel={saving ? "Saving…" : "Continue"}
        nextDisabled={saving || content === null || !content.trim()}
      />
    </div>
  );
}

/* ---------- ⑤ Test chat ---------- */

function StepTest({
  headingRef,
  bot,
  onDone,
  onBack,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  bot: WizardBot;
  onDone: () => void;
  onBack: () => void;
}) {
  const config: WidgetConfig = {
    botKey: bot.publicKey,
    name: bot.name,
    greeting: bot.greeting,
    intro: bot.intro,
    placeholder: bot.placeholder,
    primaryColor: bot.primaryColor,
    quickStarts: bot.quickStarts,
  };
  return (
    <div>
      <StepHeading
        headingRef={headingRef}
        title="Try your bot"
        sub="This is live — same knowledge, same prompt, same branding your visitors will get. Ask it something from the docs you added."
      />
      <div
        className="mt-6 h-[26rem] max-h-[70dvh] rounded-2xl overflow-hidden border border-border shadow-2xl shadow-black/40"
        style={{ "--primary": bot.primaryColor, "--ring": bot.primaryColor } as React.CSSProperties}
      >
        <ChatWidget config={config} mode="embedded" />
      </div>
      <WizardNav onBack={onBack} onNext={onDone} nextLabel="Looks good" />
    </div>
  );
}

/* ---------- ⑥ Done ---------- */

function StepDone({
  headingRef,
  bot,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  bot: WizardBot;
}) {
  const [copied, setCopied] = useState<"share" | "embed" | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/chat/${bot.slug}`;
  const embedSnippet = `<script src="${origin}/embed.js" data-bot-key="${bot.publicKey}" async></script>`;

  async function copy(kind: "share" | "embed", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-full bg-success/15 ring-1 ring-success/40 flex items-center justify-center text-success">
          <Sparkles className="size-5" />
        </div>
        <StepHeading
          headingRef={headingRef}
          title={`${bot.name} is live`}
          sub="Share it, embed it, and watch real questions arrive in your dashboard."
        />
      </div>

      <div className="mt-6 space-y-3">
        <Card>
          <CardContent className="p-4">
            <Label className="text-xs text-muted-foreground">Share link</Label>
            <div className="mt-1.5 flex gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs h-11" />
              <Button
                variant="secondary"
                size="icon"
                onClick={() => copy("share", shareUrl)}
                aria-label="Copy share link"
                className="size-11"
              >
                {copied === "share" ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              </Button>
              <Button variant="secondary" size="icon" asChild aria-label="Open share page" className="size-11">
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Label className="text-xs text-muted-foreground">Embed on any site</Label>
            <div className="mt-1.5 flex gap-2">
              <Input readOnly value={embedSnippet} className="font-mono text-xs h-11" />
              <Button
                variant="secondary"
                size="icon"
                onClick={() => copy("embed", embedSnippet)}
                aria-label="Copy embed snippet"
                className="size-11"
              >
                {copied === "embed" ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Paste before <span className="font-mono">&lt;/body&gt;</span> — a launcher appears
              bottom-right.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <Button asChild className="min-h-11">
          <Link href={`/admin/${bot.slug}`}>
            Go to dashboard
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="min-h-11">
          {/* full navigation, not client routing — remounts the wizard fresh */}
          <a href="/onboarding">Create another bot</a>
        </Button>
      </div>
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  submit,
}: {
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  submit?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between">
      <Button type="button" variant="ghost" onClick={onBack} className="min-h-11">
        <ArrowLeft className="size-4" />
        Back
      </Button>
      <Button
        type={submit ? "submit" : "button"}
        onClick={submit ? undefined : onNext}
        disabled={nextDisabled}
        className="min-h-11"
      >
        {nextLabel}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
