import { NextRequest } from "next/server";
import { getBotBySlugAsync } from "@/lib/bots";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tightly scoped to social-platform domains. Tavily's `include_domains`
// restricts results to these — the admin can't broaden the surface.
const PLATFORM_DOMAINS: Record<string, string[]> = {
  reddit: ["reddit.com", "old.reddit.com"],
  x: ["twitter.com", "x.com", "nitter.net"],
  linkedin: ["linkedin.com"],
  hackernews: ["news.ycombinator.com"],
};

const VALID_DAYS = new Set([1, 7, 14, 30]);

type Body = {
  query?: string;
  days?: number;
  platforms?: string[];
};

export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
};

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  const days = Number(body.days);
  const platforms = Array.isArray(body.platforms) ? body.platforms : [];

  if (!query) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }
  if (!VALID_DAYS.has(days)) {
    return Response.json(
      { error: "days must be one of 1, 7, 14, 30" },
      { status: 400 }
    );
  }
  const requestedDomains = platforms
    .flatMap((p) => PLATFORM_DOMAINS[p] ?? [])
    .filter(Boolean);
  if (requestedDomains.length === 0) {
    return Response.json(
      { error: "Pick at least one platform" },
      { status: 400 }
    );
  }

  const apiKey = getSetting("tavily_api_key");
  if (!apiKey) {
    return Response.json(
      { error: "Tavily API key is not set. Add it in /admin/settings." },
      { status: 500 }
    );
  }

  // Tavily Search API: https://docs.tavily.com/docs/rest-api/api-reference
  // We use `topic: "news"` because it's the topic that respects the `days` filter.
  // Social-platform domains (Reddit threads, HN, X posts) are covered fine by news topic.
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        topic: "news",
        days,
        search_depth: "basic",
        max_results: 15,
        include_domains: requestedDomains,
        include_answer: false,
        include_raw_content: false,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as
      | { results?: TavilyResult[]; error?: string }
      | Record<string, unknown>;
    if (!res.ok) {
      return Response.json(
        { error: (data as { error?: string }).error ?? `Tavily ${res.status}` },
        { status: res.status }
      );
    }
    const results = Array.isArray((data as { results?: TavilyResult[] }).results)
      ? (data as { results: TavilyResult[] }).results
      : [];
    return Response.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
