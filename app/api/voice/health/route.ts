import { NextRequest } from "next/server";
import { getBotByPublicKeyAsync } from "@/lib/bots";
import { checkVoiceHealth, voiceGloballyEnabled } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Widget-facing capability probe: called once per panel mount. */
export async function GET(req: NextRequest) {
  const botKey = req.nextUrl.searchParams.get("botKey") ?? "";
  const bot = await getBotByPublicKeyAsync(botKey);
  if (!bot) return Response.json({ error: "unknown bot" }, { status: 404 });

  const off = {
    voice: { available: false, stt: false, tts: false, handsfree: false, autoplay: false, languages: [] as string[] },
  };
  if (!bot.voice_enabled || !voiceGloballyEnabled()) return Response.json(off);

  const health = await checkVoiceHealth();
  if (!health?.ok) return Response.json(off);

  return Response.json({
    voice: {
      available: true,
      stt: !!bot.stt_enabled,
      tts: !!bot.tts_enabled,
      handsfree: !!bot.handsfree_enabled && !!bot.stt_enabled && !!bot.tts_enabled,
      autoplay: !!bot.voice_autoplay,
      languages: health.tts.languages ?? [],
    },
  });
}
