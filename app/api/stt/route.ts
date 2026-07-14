import { NextRequest } from "next/server";
import { getBotByPublicKey } from "@/lib/bots";
import { getVoiceServiceUrl, normalizeLanguage, takeVoiceToken, voiceGloballyEnabled } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // ~2 min of opus with headroom

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "expected multipart form data" }, { status: 400 });
  }

  const botKey = String(form.get("botKey") ?? "");
  const bot = getBotByPublicKey(botKey);
  if (!bot) return Response.json({ error: "unknown bot" }, { status: 404 });
  if (!bot.voice_enabled || !bot.stt_enabled || !voiceGloballyEnabled()) {
    return Response.json({ error: "voice input is not enabled for this bot" }, { status: 403 });
  }
  if (!takeVoiceToken(bot.id)) {
    return Response.json({ error: "too many voice requests" }, { status: 429 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "audio file is required" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "audio too large" }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "audio");
  const hint = normalizeLanguage(String(form.get("language") ?? ""));
  if (hint) upstream.append("language", hint);

  try {
    const res = await fetch(`${getVoiceServiceUrl()}/stt`, {
      method: "POST",
      body: upstream,
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      const status = res.status === 413 ? 413 : 502;
      return Response.json({ error: "transcription failed", ...detail }, { status });
    }
    const data = (await res.json()) as {
      text: string;
      language: string;
      language_probability: number;
    };
    return Response.json({
      text: data.text,
      language: normalizeLanguage(data.language),
      confidence: data.language_probability,
    });
  } catch {
    // Sidecar down or timed out — the widget keeps the typed-input path.
    return Response.json({ error: "voice service unavailable" }, { status: 503 });
  }
}
