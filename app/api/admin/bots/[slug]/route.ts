import { NextRequest } from "next/server";
import {
  deleteBot,
  getBotBySlug,
  isValidHslTriple,
  serializeBot,
  updateBot,
  type Bot,
} from "@/lib/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  return Response.json({ bot: serializeBot(bot) });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    greeting?: string;
    intro?: string;
    placeholder?: string;
    primaryColor?: string;
    quickStarts?: string[];
    model?: string;
    voiceEnabled?: boolean;
    sttEnabled?: boolean;
    ttsEnabled?: boolean;
    voiceAutoplay?: boolean;
    handsfreeEnabled?: boolean;
    voiceLanguage?: string;
    ttsVoices?: Record<string, string>;
    replyInUserLanguage?: boolean;
  } | null;
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  if (body.name !== undefined && !body.name.trim()) {
    return Response.json({ error: "name cannot be empty" }, { status: 400 });
  }
  if (body.primaryColor !== undefined && !isValidHslTriple(body.primaryColor)) {
    return Response.json(
      { error: 'primaryColor must be an HSL triple like "217 91% 60%"' },
      { status: 400 }
    );
  }

  if (body.voiceLanguage !== undefined) {
    const v = body.voiceLanguage.trim().toLowerCase();
    if (v !== "auto" && !/^[a-z]{2}(-[a-z]{2})?$/.test(v)) {
      return Response.json(
        { error: 'voiceLanguage must be "auto" or an ISO code like "en" or "pt-br"' },
        { status: 400 }
      );
    }
  }
  if (body.ttsVoices !== undefined) {
    if (
      typeof body.ttsVoices !== "object" ||
      body.ttsVoices === null ||
      Array.isArray(body.ttsVoices) ||
      Object.values(body.ttsVoices).some((v) => typeof v !== "string")
    ) {
      return Response.json(
        { error: "ttsVoices must be an object mapping language codes to voice ids" },
        { status: 400 }
      );
    }
  }

  const patch: Partial<
    Pick<
      Bot,
      | "name"
      | "greeting"
      | "intro"
      | "placeholder"
      | "primary_color"
      | "quick_starts"
      | "model"
      | "voice_enabled"
      | "stt_enabled"
      | "tts_enabled"
      | "voice_autoplay"
      | "handsfree_enabled"
      | "voice_language"
      | "tts_voices"
      | "reply_in_user_language"
    >
  > = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.greeting !== undefined) patch.greeting = body.greeting;
  if (body.intro !== undefined) patch.intro = body.intro;
  if (body.placeholder !== undefined) patch.placeholder = body.placeholder;
  if (body.primaryColor !== undefined) patch.primary_color = body.primaryColor.trim();
  if (body.model !== undefined) patch.model = body.model.trim();
  if (body.quickStarts !== undefined) {
    if (!Array.isArray(body.quickStarts)) {
      return Response.json({ error: "quickStarts must be an array" }, { status: 400 });
    }
    patch.quick_starts = JSON.stringify(
      body.quickStarts.filter((q) => typeof q === "string" && q.trim()).slice(0, 3)
    );
  }

  if (body.voiceEnabled !== undefined) patch.voice_enabled = body.voiceEnabled ? 1 : 0;
  if (body.sttEnabled !== undefined) patch.stt_enabled = body.sttEnabled ? 1 : 0;
  if (body.ttsEnabled !== undefined) patch.tts_enabled = body.ttsEnabled ? 1 : 0;
  if (body.voiceAutoplay !== undefined) patch.voice_autoplay = body.voiceAutoplay ? 1 : 0;
  if (body.handsfreeEnabled !== undefined)
    patch.handsfree_enabled = body.handsfreeEnabled ? 1 : 0;
  if (body.voiceLanguage !== undefined) patch.voice_language = body.voiceLanguage.trim().toLowerCase();
  if (body.ttsVoices !== undefined) patch.tts_voices = JSON.stringify(body.ttsVoices);
  if (body.replyInUserLanguage !== undefined)
    patch.reply_in_user_language = body.replyInUserLanguage ? 1 : 0;

  const updated = updateBot(bot.id, patch);
  return Response.json({ bot: serializeBot(updated) });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  deleteBot(bot.id);
  return Response.json({ ok: true });
}
