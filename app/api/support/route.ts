import { NextRequest } from "next/server";
import { createSupportRequest } from "@/lib/conversations";
import { getBotByPublicKeyAsync } from "@/lib/bots";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    botKey?: string;
    email?: string;
    message?: string;
    conversationId?: string | null;
  } | null;

  if (!body || !body.email || !body.message) {
    return Response.json({ error: "email and message are required" }, { status: 400 });
  }
  if (!body.botKey) {
    return Response.json({ error: "botKey is required" }, { status: 400 });
  }
  const bot = await getBotByPublicKeyAsync(body.botKey);
  if (!bot) {
    return Response.json({ error: "Unknown bot" }, { status: 404 });
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email);
  if (!emailOk) {
    return Response.json({ error: "invalid email" }, { status: 400 });
  }
  const created = await createSupportRequest({
    botId: bot.id,
    conversationId: body.conversationId ?? null,
    email: body.email.trim(),
    message: body.message.trim(),
  });
  return Response.json({ ok: true, id: created.id });
}
