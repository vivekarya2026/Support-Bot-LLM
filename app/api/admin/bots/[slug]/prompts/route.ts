import { NextRequest } from "next/server";
import { getBotBySlugAsync } from "@/lib/bots";
import { createPrompt, createPromptFromTemplate, listPrompts } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  return Response.json({
    prompts: await listPrompts(bot.id),
    activePromptId: bot.active_prompt_id,
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    content?: string;
    templateId?: string;
  } | null;
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  try {
    const prompt = body.templateId
      ? await createPromptFromTemplate(bot.id, body.templateId)
      : await createPrompt(bot.id, { name: body.name ?? "", content: body.content ?? "" });
    return Response.json({ prompt }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
