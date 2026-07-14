"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PlusCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Result = {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
};

const TIME_OPTIONS = [
  { label: "24 hours ago", days: 1 },
  { label: "Last week", days: 7 },
  { label: "2 weeks ago", days: 14 },
  { label: "Last month", days: 30 },
] as const;

const PLATFORM_OPTIONS = [
  { id: "reddit", label: "Reddit" },
  { id: "x", label: "X / Twitter" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "hackernews", label: "Hacker News" },
] as const;

const PLATFORM_HOST: Record<string, string> = {
  "reddit.com": "Reddit",
  "old.reddit.com": "Reddit",
  "twitter.com": "X",
  "x.com": "X",
  "nitter.net": "X",
  "linkedin.com": "LinkedIn",
  "news.ycombinator.com": "Hacker News",
};

function platformOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return PLATFORM_HOST[host] ?? host;
  } catch {
    return "Unknown";
  }
}

export function SocialListening({ botSlug, botName }: { botSlug: string; botName: string }) {
  const [query, setQuery] = useState(botName);
  const [days, setDays] = useState<number | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([
    "reddit",
    "x",
    "linkedin",
    "hackernews",
  ]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState<Record<string, boolean>>({});
  const [indexed, setIndexed] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function togglePlatform(id: string) {
    setPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function showFlash(kind: "ok" | "err", text: string) {
    setFlash({ kind, text });
    setTimeout(() => setFlash(null), 4000);
  }

  async function scrape() {
    if (days === null) {
      setError("Pick a time window first.");
      return;
    }
    if (platforms.length === 0) {
      setError("Pick at least one platform.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    setIndexed({});
    try {
      const res = await fetch(`/api/admin/bots/${botSlug}/social/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), days, platforms }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Search failed: ${res.status}`);
      setResults(j.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function indexResult(r: Result) {
    setIndexing((m) => ({ ...m, [r.url]: true }));
    try {
      const res = await fetch(`/api/admin/bots/${botSlug}/social/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: r.url, title: r.title, content: r.content }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Failed: ${res.status}`);
      setIndexed((m) => ({ ...m, [r.url]: true }));
      showFlash("ok", `Added to knowledge base (${j.chunkCount} chunks)`);
    } catch (e) {
      showFlash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setIndexing((m) => ({ ...m, [r.url]: false }));
    }
  }

  const canScrape = days !== null && platforms.length > 0 && query.trim().length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Social listening</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Pull recent posts and threads about {botName} from social platforms. Powered by
        Tavily Research — scoped to social domains only. Pick a time window, then run the
        scrape. Useful threads can be added to this bot&rsquo;s knowledge base so it can
        cite them.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Search</CardTitle>
          <CardDescription>
            Query + time window + platforms. The search only fires when you click Scrape.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-sm">Query</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`e.g. ${botName}, your product name, your category`}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Time window</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setDays(opt.days)}
                  className={cn(
                    "px-3 py-2 min-h-11 rounded-md border text-sm text-left transition-colors",
                    days === opt.days
                      ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary/30"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    days={opt.days}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Required — Tavily only runs once you&rsquo;ve picked a window.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={cn(
                      "px-3 py-1.5 min-h-11 rounded-full border text-sm transition-colors",
                      on
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    aria-pressed={on}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-1 flex items-center gap-3">
            <Button onClick={scrape} disabled={!canScrape || loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Scraping…
                </>
              ) : (
                <>
                  <Search className="size-4" /> Scrape
                </>
              )}
            </Button>
            {!canScrape && (
              <span className="text-xs text-muted-foreground">
                Pick a time window and at least one platform.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {flash && (
        <Alert
          className={cn(
            "mt-4",
            flash.kind === "ok"
              ? "border-success/40 bg-success/10 text-foreground"
              : "border-destructive/40 bg-destructive/10 text-foreground"
          )}
        >
          {flash.kind === "ok" ? (
            <CheckCircle2 className="size-4 text-success" />
          ) : (
            <AlertCircle className="size-4 text-destructive" />
          )}
          <AlertDescription>{flash.text}</AlertDescription>
        </Alert>
      )}

      {results !== null && (
        <div className="mt-6 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">
              Results {results.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({results.length})
                </span>
              )}
            </h2>
          </div>
          {results.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-center text-muted-foreground">
                No posts found for &ldquo;{query}&rdquo; in this window. Try widening the
                time range or rephrasing the query.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {results.map((r) => (
                <Card key={r.url} className="hover:border-border transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="secondary" className="text-xs">
                            {platformOf(r.url)}
                          </Badge>
                          {r.published_date && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(r.published_date).toLocaleDateString()}
                            </span>
                          )}
                          {typeof r.score === "number" && (
                            <span className="text-xs text-muted-foreground">
                              · relevance {r.score.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors inline-flex items-start gap-1 group"
                        >
                          <span className="line-clamp-2">{r.title || r.url}</span>
                          <ExternalLink className="size-3 mt-1 shrink-0 opacity-60 group-hover:opacity-100" />
                        </a>
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {r.content}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {indexed[r.url] ? (
                          <Badge className="bg-success/15 text-success border-success/40 hover:bg-success/15">
                            <CheckCircle2 className="size-3" />
                            In KB
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => indexResult(r)}
                            disabled={indexing[r.url]}
                          >
                            {indexing[r.url] ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <PlusCircle className="size-3.5" />
                            )}
                            Index
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
