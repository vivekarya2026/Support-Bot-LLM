import { NextRequest } from "next/server";
import { getBotBySlug } from "@/lib/bots";
import { listSupportRequests } from "@/lib/conversations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  return Response.json({ requests: listSupportRequests(bot.id) });
}
