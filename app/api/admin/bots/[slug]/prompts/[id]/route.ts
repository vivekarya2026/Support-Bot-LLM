import { NextRequest } from "next/server";
import { getBotBySlug } from "@/lib/bots";
import { deletePrompt, getPrompt, updatePrompt } from "@/lib/prompts";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  const promptId = Number(id);
  if (!getPrompt(bot.id, promptId)) {
    return Response.json({ error: "prompt not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    content?: string;
  } | null;
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  const prompt = updatePrompt(bot.id, promptId, { name: body.name, content: body.content });
  return Response.json({ prompt });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  const promptId = Number(id);
  if (!getPrompt(bot.id, promptId)) {
    return Response.json({ error: "prompt not found" }, { status: 404 });
  }

  try {
    deletePrompt(bot.id, promptId);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as Error & { code?: string }).code === "active" ? 409 : 500;
    return Response.json({ error: message }, { status });
  }
}
