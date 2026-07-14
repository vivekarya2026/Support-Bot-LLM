"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import type { SerializedBot } from "@/lib/bots";

type AdminVoiceInfo = {
  configured: boolean;
  health: { ok: boolean; tts?: { languages?: string[] } } | null;
  voices: { id: string; engine: string; language: string; name: string; license: string }[];
};

const SELECT_CLS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function langName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function isNonCommercial(license: string): boolean {
  return /cpml|non-?commercial|nc\b|by-nc/i.test(license);
}

const SWATCHES: { label: string; hsl: string }[] = [
  { label: "Blue", hsl: "217 91% 60%" },
  { label: "Indigo", hsl: "239 84% 67%" },
  { label: "Violet", hsl: "258 90% 66%" },
  { label: "Cyan", hsl: "189 94% 43%" },
  { label: "Emerald", hsl: "160 84% 39%" },
  { label: "Amber", hsl: "38 92% 50%" },
  { label: "Rose", hsl: "347 77% 50%" },
];

export function BotSettingsForm({ initial }: { initial: SerializedBot }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [greeting, setGreeting] = useState(initial.greeting);
  const [intro, setIntro] = useState(initial.intro);
  const [placeholder, setPlaceholder] = useState(initial.placeholder);
  const [color, setColor] = useState(initial.primaryColor);
  const [quickStarts, setQuickStarts] = useState<string[]>(
    [...initial.quickStarts, "", "", ""].slice(0, 3)
  );
  const [model, setModel] = useState(initial.model);
  const [voiceEnabled, setVoiceEnabled] = useState(initial.voiceEnabled);
  const [sttEnabled, setSttEnabled] = useState(initial.sttEnabled);
  const [ttsEnabled, setTtsEnabled] = useState(initial.ttsEnabled);
  const [voiceAutoplay, setVoiceAutoplay] = useState(initial.voiceAutoplay);
  const [handsfreeEnabled, setHandsfreeEnabled] = useState(initial.handsfreeEnabled);
  const [voiceLanguage, setVoiceLanguage] = useState(initial.voiceLanguage);
  const [ttsVoices, setTtsVoices] = useState<Record<string, string>>(initial.ttsVoices);
  const [replyInUserLanguage, setReplyInUserLanguage] = useState(initial.replyInUserLanguage);
  const [voiceInfo, setVoiceInfo] = useState<AdminVoiceInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<"ok" | "err">("ok");
  const [copied, setCopied] = useState<"embed" | "share" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/chat/${initial.slug}`;
  const embedSnippet = `<script src="${origin}/embed.js" data-bot-key="${initial.publicKey}" async></script>`;

  const lightness = useMemo(() => {
    const m = color.trim().match(/(\d+(?:\.\d+)?)%$/);
    return m ? Number(m[1]) : 60;
  }, [color]);

  useEffect(() => {
    let stale = false;
    fetch("/api/admin/voice")
      .then((r) => (r.ok ? (r.json() as Promise<AdminVoiceInfo>) : null))
      .then((j) => {
        if (!stale && j) setVoiceInfo(j);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, []);

  const voicesByLang = useMemo(() => {
    const map: Record<string, AdminVoiceInfo["voices"]> = {};
    for (const v of voiceInfo?.voices ?? []) {
      (map[v.language] ??= []).push(v);
    }
    return map;
  }, [voiceInfo]);
  const ttsLanguages = useMemo(() => Object.keys(voicesByLang).sort(), [voicesByLang]);
  const voiceServiceUp = !!voiceInfo?.configured && !!voiceInfo?.health?.ok;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/bots/${initial.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          greeting,
          intro,
          placeholder,
          primaryColor: color,
          quickStarts: quickStarts.map((q) => q.trim()).filter(Boolean),
          model,
          voiceEnabled,
          sttEnabled,
          ttsEnabled,
          voiceAutoplay,
          handsfreeEnabled,
          voiceLanguage,
          ttsVoices,
          replyInUserLanguage,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Save failed: ${res.status}`);
      setMsgKind("ok");
      setMsg("Saved.");
      router.refresh();
    } catch (err) {
      setMsgKind("err");
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function copy(kind: "embed" | "share", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/bots/${initial.slug}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Delete failed: ${res.status}`);
      }
      window.location.href = "/admin";
    } catch (err) {
      setMsgKind("err");
      setMsg(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Bot settings</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Everything your visitors see — name, voice, color — plus where this bot lives.
      </p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <form onSubmit={save} className="space-y-4 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Branding</CardTitle>
              <CardDescription>
                Shown in the widget header, greeting, and empty state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Bot name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Greeting" hint="The first line visitors read.">
                <Input value={greeting} onChange={(e) => setGreeting(e.target.value)} />
              </Field>
              <Field label="Intro" hint="One or two sentences under the greeting.">
                <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} />
              </Field>
              <Field label="Composer placeholder">
                <Input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
              </Field>
              <Field
                label="Quick-start questions"
                hint="Up to 3 chips on the empty state. Leave blank to hide."
              >
                <div className="space-y-2">
                  {quickStarts.map((q, i) => (
                    <Input
                      key={i}
                      value={q}
                      onChange={(e) =>
                        setQuickStarts((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
                      }
                      placeholder={`Question ${i + 1}`}
                    />
                  ))}
                </div>
              </Field>
              <Field
                label="Brand color"
                hint={
                  lightness > 72
                    ? "That's quite light — white text on it may fail contrast. Pick a mid/dark tone."
                    : "Used for the launcher, header accent, buttons, and user bubbles."
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES.map((s) => (
                    <button
                      key={s.hsl}
                      type="button"
                      title={s.label}
                      onClick={() => setColor(s.hsl)}
                      className={
                        "size-9 rounded-full ring-2 transition-transform hover:scale-110 " +
                        (color === s.hsl ? "ring-foreground" : "ring-transparent")
                      }
                      style={{ backgroundColor: `hsl(${s.hsl})` }}
                      aria-label={`Use ${s.label}`}
                      aria-pressed={color === s.hsl}
                    />
                  ))}
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="font-mono w-36 max-w-full"
                    aria-label="HSL triple"
                  />
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model override</CardTitle>
              <CardDescription>
                Leave blank to use the global default model from{" "}
                <a href="/admin/settings" className="text-primary hover:underline">
                  global settings
                </a>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="(use global default)"
                className="font-mono"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice</CardTitle>
              <CardDescription>
                Let visitors speak to the bot and hear replies aloud, in their own language.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {voiceInfo && !voiceServiceUp && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                  <AlertTriangle className="size-3.5 mt-0.5 text-amber-500 shrink-0" />
                  <span>
                    Voice service is offline — settings still save, the widget just hides voice
                    controls until it&rsquo;s back. Start it with{" "}
                    <span className="font-mono">npm run dev:voice</span>.
                  </span>
                </div>
              )}
              <Toggle
                checked={voiceEnabled}
                onChange={setVoiceEnabled}
                label="Enable voice"
                hint="Master switch. Off hides every voice control in the widget."
              />
              <div className={voiceEnabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
                <Toggle
                  checked={sttEnabled}
                  onChange={setSttEnabled}
                  label="Voice input"
                  hint="Mic button in the composer — visitors speak, edit the transcript, then send."
                />
                <Toggle
                  checked={ttsEnabled}
                  onChange={setTtsEnabled}
                  label="Spoken replies"
                  hint="Play button on every reply."
                />
                <Toggle
                  checked={voiceAutoplay}
                  onChange={setVoiceAutoplay}
                  disabled={!ttsEnabled}
                  label="Auto-speak replies"
                  hint="Replies play automatically. Note: screen-reader users may hear replies twice."
                />
                <Toggle
                  checked={handsfreeEnabled}
                  onChange={setHandsfreeEnabled}
                  disabled={!sttEnabled || !ttsEnabled}
                  label="Hands-free conversation"
                  hint="Adds a headphones button: speak, hear the answer, mic re-arms."
                />
                <Toggle
                  checked={replyInUserLanguage}
                  onChange={setReplyInUserLanguage}
                  label="Reply in the visitor's language"
                  hint="Detected from their speech. A fixed default language below overrides detection."
                />
                <Field
                  label="Default language"
                  hint='"Auto-detect" follows whatever language the visitor speaks.'
                >
                  <select
                    value={voiceLanguage}
                    onChange={(e) => setVoiceLanguage(e.target.value)}
                    className={SELECT_CLS}
                    aria-label="Default language"
                  >
                    <option value="auto">Auto-detect</option>
                    {ttsLanguages.map((l) => (
                      <option key={l} value={l}>
                        {langName(l)}
                      </option>
                    ))}
                  </select>
                </Field>
                {ttsLanguages.length > 0 ? (
                  <Field
                    label="Voice per language"
                    hint="Voices marked non-commercial are licensed for non-commercial deployments only."
                  >
                    <div className="space-y-2">
                      {ttsLanguages.map((lang) => (
                        <div key={lang} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs text-muted-foreground">
                            {langName(lang)}
                          </span>
                          <select
                            value={ttsVoices[lang] ?? ""}
                            onChange={(e) =>
                              setTtsVoices((prev) => {
                                const next = { ...prev };
                                if (e.target.value) next[lang] = e.target.value;
                                else delete next[lang];
                                return next;
                              })
                            }
                            className={SELECT_CLS}
                            aria-label={`Voice for ${langName(lang)}`}
                          >
                            <option value="">Default</option>
                            {voicesByLang[lang].map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                                {isNonCommercial(v.license) ? " — non-commercial license" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </Field>
                ) : (
                  voiceInfo &&
                  voiceServiceUp && (
                    <p className="text-xs text-muted-foreground">
                      No voices reported by the voice service yet — it may still be downloading
                      models.
                    </p>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {msg && (
              <span
                className={"text-xs " + (msgKind === "ok" ? "text-success" : "text-destructive")}
              >
                {msg}
              </span>
            )}
          </div>
        </form>

        {/* Live preview + distribution */}
        <div className="space-y-4">
          <div
            className="contents"
            style={
              {
                "--primary": color,
                "--ring": color,
              } as React.CSSProperties
            }
          >
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/15 via-card to-card">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {name || "Your bot"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Online — usually answers in seconds
                    </div>
                  </div>
                </div>
              </div>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground">{greeting || "Hi!"}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {intro || "Ask me anything."}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {quickStarts
                    .filter((q) => q.trim())
                    .map((q) => (
                      <span
                        key={q}
                        className="text-xs px-2.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-foreground"
                      >
                        {q}
                      </span>
                    ))}
                </div>
                <div className="mt-4 h-9 rounded-md border border-input px-3 flex items-center text-xs text-muted-foreground">
                  {placeholder || "Ask me anything…"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Share &amp; embed</CardTitle>
              <CardDescription>Give visitors a page, or drop the widget on any site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Share link</Label>
                <div className="mt-1 flex gap-2">
                  <Input readOnly value={shareUrl} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => copy("share", shareUrl)}
                    aria-label="Copy share link"
                  >
                    {copied === "share" ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  </Button>
                  <Button type="button" variant="secondary" size="icon" asChild aria-label="Open share page">
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Embed snippet</Label>
                <div className="mt-1 flex gap-2">
                  <Input readOnly value={embedSnippet} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => copy("embed", embedSnippet)}
                    aria-label="Copy embed snippet"
                  >
                    {copied === "embed" ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Paste before <span className="font-mono">&lt;/body&gt;</span> on any site — a
                  launcher appears bottom-right.
                </p>
              </div>
            </CardContent>
          </Card>

          <section>
            <h2 className="text-xs font-medium text-destructive uppercase tracking-wider">
              Danger zone
            </h2>
            <Card className="mt-2 border-destructive/30">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  Delete workspace
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Removes this bot, its knowledge base, prompts, conversations, and support
                  requests. This can&rsquo;t be undone.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setDeleteOpen(true)}
                  className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Delete workspace…
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteOpen(false);
            setDeleteConfirm("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {initial.name}?</DialogTitle>
            <DialogDescription>
              Everything in this workspace is permanently removed. Type{" "}
              <span className="font-mono text-foreground">{initial.slug}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={initial.slug}
            className="font-mono"
            autoComplete="off"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteConfirm("");
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting || deleteConfirm !== initial.slug}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <span className="size-4 border-2 border-destructive-foreground/40 border-t-destructive-foreground rounded-full animate-spin" />
              ) : (
                "Delete workspace"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors " +
          (checked ? "bg-primary" : "bg-muted") +
          (disabled ? " opacity-40 pointer-events-none" : "")
        }
      >
        <span
          className={
            "absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform " +
            (checked ? "translate-x-[22px]" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      <div className="pt-0.5">{children}</div>
    </div>
  );
}
