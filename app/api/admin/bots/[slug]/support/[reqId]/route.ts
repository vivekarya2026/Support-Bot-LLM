import { NextRequest } from "next/server";
import { getBotBySlug } from "@/lib/bots";
import {
  getConversation,
  getSupportRequest,
  updateSupportStatus,
  type SupportRequest,
} from "@/lib/conversations";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string; reqId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug, reqId } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  const request = getSupportRequest(bot.id, Number(reqId));
  if (!request) return Response.json({ error: "not found" }, { status: 404 });
  const conversation = request.conversation_id ? getConversation(request.conversation_id) : null;
  return Response.json({ request, conversation });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { slug, reqId } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { status?: SupportRequest["status"] } | null;
  if (!body?.status || !["new", "in_progress", "resolved"].includes(body.status)) {
    return Response.json({ error: "invalid status" }, { status: 400 });
  }
  if (!updateSupportStatus(bot.id, Number(reqId), body.status)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
