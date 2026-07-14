import { NextRequest } from "next/server";
import { getBotBySlugAsync } from "@/lib/bots";
import { listConversations } from "@/lib/conversations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  return Response.json({ conversations: await listConversations(bot.id) });
}
