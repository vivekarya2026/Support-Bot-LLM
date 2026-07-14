import { NextRequest } from "next/server";
import { getConversation } from "@/lib/conversations";
import { getBotByPublicKeyAsync } from "@/lib/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public conversation resume for the widget's "pick up where you left off".
 * The caller must present the owning bot's public key — a conversation id
 * alone is never enough to read a transcript back.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const botKey = req.nextUrl.searchParams.get("botKey") ?? "";
  const bot = botKey ? await getBotByPublicKeyAsync(botKey) : undefined;
  if (!bot) return Response.json({ error: "Unknown bot" }, { status: 404 });

  const { conversation, messages } = await getConversation(id);
  if (!conversation || conversation.bot_id !== bot.id) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }
  return Response.json({
    conversation: { id: conversation.id, title: conversation.title },
    messages: messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role,
        content: m.content,
        citations: m.citations ? JSON.parse(m.citations) : null,
      })),
  });
}
