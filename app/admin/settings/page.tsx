"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROVIDERS, findProviderByBaseUrl, type ProviderId } from "@/lib/providers";

type RedactedSettings = {
  openrouter_api_key: string;
  openrouter_base_url: string;
  default_model: string;
  tavily_api_key: string;
  voice_service_url: string;
  openrouter_api_key_set: boolean;
  tavily_api_key_set: boolean;
};

type DiscoveredModel = { id: string; label: string };

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function GlobalSettingsPage() {
  const [settings, setSettings] = useState<RedactedSettings | null>(null);
  const [providerId, setProviderId] = useState<ProviderId>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [voiceUrl, setVoiceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<"ok" | "err">("ok");

  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[] | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const currentProvider = useMemo(
    () => PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0],
    [providerId]
  );

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((s: RedactedSettings) => {
        setSettings(s);
        setBaseUrl(s.openrouter_base_url);
        setModel(s.default_model);
        setVoiceUrl(s.voice_service_url);
        const matched = findProviderByBaseUrl(s.openrouter_base_url);
        setProviderId(matched?.id ?? "custom");
      });
  }, []);

  function handleProviderChange(next: ProviderId) {
    setProviderId(next);
    const preset = PROVIDERS.find((p) => p.id === next);
    if (preset && preset.id !== "custom") {
      setBaseUrl(preset.defaultBaseUrl);
    }
    setDiscoveredModels(null);
    setDiscoverError(null);
  }

  async function fetchModels() {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey }),
      });
      const json = (await res.json()) as { models?: DiscoveredModel[]; error?: string };
      if (!res.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const models = json.models ?? [];
      setDiscoveredModels(models);
      if (models.length > 0 && !models.some((m) => m.id === model)) {
        setModel(models[0].id);
      }
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : String(err));
      setDiscoveredModels(null);
    } finally {
      setDiscovering(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openrouter_api_key: apiKey,
          openrouter_base_url: baseUrl,
          default_model: model,
          tavily_api_key: tavilyKey,
          voice_service_url: voiceUrl,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as RedactedSettings;
      setSettings(updated);
      setApiKey("");
      setTavilyKey("");
      setMsgKind("ok");
      setMsg("Saved.");
    } catch (err) {
      setMsgKind("err");
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  if (!settings)
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 text-sm text-muted-foreground">Loading…</div>
    );

  const modelOptions = discoveredModels ?? currentProvider.fallbackModels;
  const useModelDropdown = modelOptions.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href="/admin"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-3.5" />
        All workspaces
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mt-3">Global settings</h1>
      <p className="text-sm text-muted-foreground mt-1">
        One LLM connection powers every workspace. Bot-specific things — name, branding,
        prompts, knowledge — live inside each workspace. Works with any OpenAI-compatible
        endpoint (OpenRouter, OpenAI, Gemini, Groq, Together, LM Studio…). Stored locally.
      </p>

      <form onSubmit={save} className="mt-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provider connection</CardTitle>
            <CardDescription>
              Pick a preset to prefill the base URL, then paste the key for that
              provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Provider">
              <select
                className={SELECT_CLS}
                value={providerId}
                onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="API key"
              hint={
                settings.openrouter_api_key_set
                  ? `Current: ${settings.openrouter_api_key}. Leave blank to keep.`
                  : currentProvider.keyRequired
                    ? `Paste the API key for ${currentProvider.label}.`
                    : `Optional for ${currentProvider.label} — leave blank if it isn't required.`
              }
            >
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  settings.openrouter_api_key_set
                    ? "(keep existing)"
                    : currentProvider.keyHint
                }
                className="font-mono"
              />
            </Field>

            <Field
              label="API base URL"
              hint={`Preset default: ${currentProvider.defaultBaseUrl || "(none — enter your own)"}`}
            >
              <Input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="font-mono"
              />
            </Field>

            <Field
              label="Default model"
              hint={
                useModelDropdown
                  ? discoveredModels
                    ? `${discoveredModels.length} model${discoveredModels.length === 1 ? "" : "s"} discovered from the server.`
                    : "Showing built-in defaults. Click “Fetch from server” to list what your endpoint exposes."
                  : "Type the model id manually, or click “Fetch from server” to discover."
              }
            >
              <div className="flex gap-2">
                {useModelDropdown ? (
                  <select
                    className={SELECT_CLS + " font-mono"}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {!modelOptions.some((m) => m.id === model) && model && (
                      <option value={model}>{model} (current)</option>
                    )}
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="font-mono"
                    placeholder="e.g. google/gemma-3-4b-it"
                  />
                )}
                {currentProvider.supportsListModels && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={fetchModels}
                    disabled={discovering || !baseUrl}
                  >
                    {discovering ? "Fetching…" : "Fetch from server"}
                  </Button>
                )}
              </div>
              {discoverError && (
                <div className="mt-2 text-xs text-destructive break-all">
                  {discoverError}
                </div>
              )}
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Social listening (Tavily)</CardTitle>
            <CardDescription>
              Optional. Adds a Tavily Research API key so each workspace&rsquo;s Social
              Listening page can scrape Reddit / X / LinkedIn / Hacker News. Only used
              for social-domain scrapes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field
              label="Tavily API key"
              hint={
                settings.tavily_api_key_set
                  ? `Current: ${settings.tavily_api_key}. Leave blank to keep.`
                  : "Paste your Tavily key (starts with tvly-). Get one at app.tavily.com."
              }
            >
              <Input
                type="password"
                value={tavilyKey}
                onChange={(e) => setTavilyKey(e.target.value)}
                placeholder={settings.tavily_api_key_set ? "(keep existing)" : "tvly-…"}
                className="font-mono"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voice service</CardTitle>
            <CardDescription>
              Self-hosted speech-to-text and text-to-speech sidecar (see{" "}
              <span className="font-mono">voice-service/README.md</span>). Per-bot voice
              switches live in each workspace&rsquo;s settings. Clear the URL to disable
              voice everywhere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field
              label="Voice service URL"
              hint="Default: http://127.0.0.1:8078 — start it with npm run dev:voice."
            >
              <Input
                type="text"
                value={voiceUrl}
                onChange={(e) => setVoiceUrl(e.target.value)}
                placeholder="http://127.0.0.1:8078"
                className="font-mono"
              />
            </Field>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
          {msg && (
            <span
              className={
                "text-xs " +
                (msgKind === "ok" ? "text-success" : "text-destructive")
              }
            >
              {msg}
            </span>
          )}
        </div>
      </form>
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
