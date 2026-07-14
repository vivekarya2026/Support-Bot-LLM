import { NextRequest } from "next/server";
import { getBotBySlugAsync } from "@/lib/bots";
import { duplicatePrompt } from "@/lib/prompts";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });

  try {
    const prompt = await duplicatePrompt(bot.id, Number(id));
    return Response.json({ prompt }, { status: 201 });
  } catch {
    return Response.json({ error: "prompt not found" }, { status: 404 });
  }
}
