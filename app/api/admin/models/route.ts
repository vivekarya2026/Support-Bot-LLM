import { NextRequest } from "next/server";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscoverRequest = {
  baseUrl?: string;
  apiKey?: string;
};

type ListedModel = { id: string; label: string };

// LM Studio / OpenAI / OpenRouter all return { data: [{ id: string, ... }] }
type ModelsResponse = { data?: { id?: unknown }[] };

export async function POST(req: NextRequest) {
  let body: DiscoverRequest = {};
  try {
    body = (await req.json()) as DiscoverRequest;
  } catch {
    // empty body is OK — fall back to saved settings
  }

  const baseUrl = (body.baseUrl?.trim() || getSetting("openrouter_base_url")).replace(/\/+$/, "");
  // A blank/masked key from the form means "use the saved one".
  const incomingKey = body.apiKey?.trim() ?? "";
  const apiKey =
    incomingKey && !/^•+/.test(incomingKey) ? incomingKey : getSetting("openrouter_api_key");

  if (!baseUrl) {
    return Response.json({ error: "baseUrl is required" }, { status: 400 });
  }

  const url = `${baseUrl}/models`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `Could not reach ${url}: ${msg}` },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return Response.json(
      { error: `${url} returned ${res.status}: ${text.slice(0, 300)}` },
      { status: 502 }
    );
  }

  let json: ModelsResponse;
  try {
    json = (await res.json()) as ModelsResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Invalid JSON from ${url}: ${msg}` }, { status: 502 });
  }

  const models: ListedModel[] = (json.data ?? [])
    .map((m) => (typeof m?.id === "string" ? { id: m.id, label: m.id } : null))
    .filter((m): m is ListedModel => m !== null);

  return Response.json({ models });
}
