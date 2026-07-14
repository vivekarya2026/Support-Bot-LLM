import { NextRequest } from "next/server";
import { createBot, listBotsAsync, serializeBot, isValidHslTriple } from "@/lib/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ bots: (await listBotsAsync()).map(serializeBot) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    primaryColor?: string;
    greeting?: string;
    intro?: string;
    placeholder?: string;
    quickStarts?: string[];
    templateId?: string;
  } | null;

  if (!body?.name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (body.primaryColor !== undefined && !isValidHslTriple(body.primaryColor)) {
    return Response.json(
      { error: 'primaryColor must be an HSL triple like "217 91% 60%"' },
      { status: 400 }
    );
  }
  try {
    const bot = await createBot({
      name: body.name,
      primaryColor: body.primaryColor,
      greeting: body.greeting,
      intro: body.intro,
      placeholder: body.placeholder,
      quickStarts: Array.isArray(body.quickStarts)
        ? body.quickStarts.filter((q) => typeof q === "string" && q.trim())
        : undefined,
      templateId: body.templateId,
    });
    return Response.json({ bot: serializeBot(bot) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
