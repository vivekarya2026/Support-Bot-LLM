import { NextRequest } from "next/server";
import { getBotBySlug } from "@/lib/bots";
import { resetKnowledgeBase } from "@/lib/documents";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * "Start fresh" — wipes every document, chunk, and vector for this bot.
 * The caller must echo the bot slug back as typed confirmation.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== slug) {
    return Response.json(
      { error: `Type the workspace slug ("${slug}") to confirm` },
      { status: 400 }
    );
  }
  const removed = resetKnowledgeBase(bot.id);
  return Response.json({ ok: true, removed });
}
