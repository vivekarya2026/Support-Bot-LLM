import { NextRequest } from "next/server";
import { getRedactedSettingsAsync, setSettings, type Settings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await getRedactedSettingsAsync());
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<Settings> | null;
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  const allowed: (keyof Settings)[] = [
    "openrouter_api_key",
    "openrouter_base_url",
    "default_model",
    "tavily_api_key",
    "voice_service_url",
  ];
  const update: Partial<Settings> = {};
  for (const k of allowed) {
    const v = body[k];
    if (typeof v === "string") update[k] = v;
  }
  for (const k of ["openrouter_api_key", "tavily_api_key"] as const) {
    if (update[k] === "" || /^•+/.test(update[k] ?? "")) {
      delete update[k];
    }
  }
  await setSettings(update);
  return Response.json(await getRedactedSettingsAsync());
}
