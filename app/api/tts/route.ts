import { NextRequest } from "next/server";
import { getBotByPublicKeyAsync } from "@/lib/bots";
import { getMessageForBot } from "@/lib/conversations";
import { getVoiceServiceUrl, resolveTtsTarget, takeVoiceToken, voiceGloballyEnabled } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TTS_CHARS = 2000;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    botKey?: string;
    text?: string;
    language?: string;
    messageId?: number;
  } | null;
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  const bot = await getBotByPublicKeyAsync(body.botKey ?? "");
  if (!bot) return Response.json({ error: "unknown bot" }, { status: 404 });
  if (!bot.voice_enabled || !bot.tts_enabled || !voiceGloballyEnabled()) {
    return Response.json({ error: "voice output is not enabled for this bot" }, { status: 403 });
  }
  if (!takeVoiceToken(bot.id)) {
    return Response.json({ error: "too many voice requests" }, { status: 429 });
  }

  // Prefer the persisted assistant message: the client then can't synthesize
  // arbitrary text through this bot, only actual replies.
  let text = "";
  if (typeof body.messageId === "number") {
    const msg = await getMessageForBot(body.messageId, bot.id);
    if (!msg || msg.role !== "assistant") {
      return Response.json({ error: "unknown message" }, { status: 404 });
    }
    text = msg.content;
  } else {
    text = String(body.text ?? "");
  }
  text = text.slice(0, MAX_TTS_CHARS);
  if (!text.trim()) return Response.json({ error: "text is required" }, { status: 400 });

  const target = await resolveTtsTarget(bot, body.language ?? "");
  if (!target) {
    return Response.json(
      { error: "language_unsupported", language: body.language ?? "" },
      { status: 422 }
    );
  }

  try {
    const res = await fetch(`${getVoiceServiceUrl()}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        language: target.language,
        voice_id: target.voiceId ?? undefined,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.status === 422) {
      return Response.json(
        { error: "language_unsupported", language: target.language },
        { status: 422 }
      );
    }
    if (!res.ok || !res.body) {
      return Response.json({ error: "synthesis failed" }, { status: 502 });
    }
    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=3600",
        ...(res.headers.get("content-length")
          ? { "Content-Length": res.headers.get("content-length")! }
          : {}),
      },
    });
  } catch {
    return Response.json({ error: "voice service unavailable" }, { status: 503 });
  }
}
