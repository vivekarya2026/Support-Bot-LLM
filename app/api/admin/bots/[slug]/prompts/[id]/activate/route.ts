import { NextRequest } from "next/server";
import { getBotBySlugAsync } from "@/lib/bots";
import { activatePrompt, getPrompt } from "@/lib/prompts";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  const promptId = Number(id);
  if (!(await getPrompt(bot.id, promptId))) {
    return Response.json({ error: "prompt not found" }, { status: 404 });
  }
  await activatePrompt(bot.id, promptId);
  return Response.json({ ok: true, activePromptId: promptId });
}
