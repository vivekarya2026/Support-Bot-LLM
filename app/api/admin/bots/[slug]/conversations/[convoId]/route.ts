import { NextRequest } from "next/server";
import { getBotBySlugAsync } from "@/lib/bots";
import { deleteConversation, getConversation } from "@/lib/conversations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string; convoId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug, convoId } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  const data = await getConversation(convoId);
  if (!data.conversation || data.conversation.bot_id !== bot.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(data);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { slug, convoId } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  const data = await getConversation(convoId);
  if (!data.conversation || data.conversation.bot_id !== bot.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  await deleteConversation(convoId);
  return Response.json({ ok: true });
}
