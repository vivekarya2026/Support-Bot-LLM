import { getSupabase, generatePublicKey, nowEpoch } from "./supabase";
import { getTemplate, GENERIC_TEMPLATE_ID } from "./prompt-templates";
import { getSetting } from "./settings";

export type Bot = {
  id: number;
  slug: string;
  public_key: string;
  name: string;
  greeting: string;
  intro: string;
  placeholder: string;
  primary_color: string;
  quick_starts: string;
  model: string;
  active_prompt_id: number | null;
  voice_enabled: number;
  stt_enabled: number;
  tts_enabled: number;
  voice_autoplay: number;
  handsfree_enabled: number;
  voice_language: string;
  tts_voices: string;
  reply_in_user_language: number;
  created_at: number;
  updated_at: number;
};

export type BotVoiceConfig = {
  enabled: boolean;
  stt: boolean;
  tts: boolean;
  autoplay: boolean;
  handsfree: boolean;
  language: string;
};

export type BotPublicConfig = {
  botKey: string;
  name: string;
  greeting: string;
  intro: string;
  placeholder: string;
  primaryColor: string;
  quickStarts: string[];
  voice: BotVoiceConfig;
};

export type BotListItem = Bot & {
  doc_count: number;
  conversation_count: number;
  new_support_count: number;
};

export function listBots(): BotListItem[] {
  // This is called from server components synchronously in layout.tsx.
  // For Supabase we need to make it work — we'll throw an error that
  // forces callers to use the async version instead.
  throw new Error("Use listBotsAsync() instead — Supabase requires async");
}

export async function listBotsAsync(): Promise<BotListItem[]> {
  const supabase = getSupabase();
  const { data: bots, error } = await supabase
    .from("bots")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !bots) return [];

  const results: BotListItem[] = [];
  for (const bot of bots) {
    const { count: docCount } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", bot.id);

    const { count: convoCount } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", bot.id);

    const { count: supportCount } = await supabase
      .from("support_requests")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", bot.id)
      .eq("status", "new");

    results.push({
      ...bot,
      doc_count: docCount ?? 0,
      conversation_count: convoCount ?? 0,
      new_support_count: supportCount ?? 0,
    });
  }
  return results;
}

export function countBots(): number {
  throw new Error("Use countBotsAsync() instead");
}

export async function countBotsAsync(): Promise<number> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from("bots")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export function getBotBySlug(slug: string): Bot | undefined {
  throw new Error("Use getBotBySlugAsync() instead");
}

export async function getBotBySlugAsync(slug: string): Promise<Bot | undefined> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("bots")
    .select("*")
    .eq("slug", slug)
    .single();
  return data ?? undefined;
}

export async function getBotByPublicKeyAsync(publicKey: string): Promise<Bot | undefined> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("bots")
    .select("*")
    .eq("public_key", publicKey)
    .single();
  return data ?? undefined;
}

export async function getBotByIdAsync(id: number): Promise<Bot | undefined> {
  const supabase = getSupabase();
  const { data } = await supabase.from("bots").select("*").eq("id", id).single();
  return data ?? undefined;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "bot";
}

export async function createBot(input: {
  name: string;
  primaryColor?: string;
  greeting?: string;
  intro?: string;
  placeholder?: string;
  quickStarts?: string[];
  templateId?: string;
}): Promise<Bot> {
  const supabase = getSupabase();
  const name = input.name.trim();
  if (!name) throw new Error("Bot name is required");

  const template = getTemplate(input.templateId ?? "") ?? getTemplate(GENERIC_TEMPLATE_ID)!;

  let slug = slugify(name);
  let existing = await getBotBySlugAsync(slug);
  for (let i = 2; existing; i++) {
    slug = `${slugify(name)}-${i}`;
    existing = await getBotBySlugAsync(slug);
  }

  const now = nowEpoch();
  const { data: bot, error } = await supabase
    .from("bots")
    .insert({
      slug,
      public_key: generatePublicKey(),
      name,
      greeting: input.greeting ?? template.greeting(name),
      intro: input.intro ?? template.intro,
      placeholder: input.placeholder ?? "Ask me anything…",
      primary_color: input.primaryColor ?? "217 91% 60%",
      quick_starts: JSON.stringify(input.quickStarts ?? template.quickStarts),
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error || !bot) throw new Error(`Failed to create bot: ${error?.message}`);

  const { data: prompt } = await supabase
    .from("prompts")
    .insert({
      bot_id: bot.id,
      name: template.label,
      content: template.prompt(name),
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (prompt) {
    await supabase
      .from("bots")
      .update({ active_prompt_id: prompt.id })
      .eq("id", bot.id);
  }

  return (await getBotByIdAsync(bot.id))!;
}

const UPDATABLE = [
  "name",
  "greeting",
  "intro",
  "placeholder",
  "primary_color",
  "quick_starts",
  "model",
  "voice_enabled",
  "stt_enabled",
  "tts_enabled",
  "voice_autoplay",
  "handsfree_enabled",
  "voice_language",
  "tts_voices",
  "reply_in_user_language",
] as const;

type UpdatableKey = (typeof UPDATABLE)[number];

export async function updateBot(id: number, patch: Partial<Pick<Bot, UpdatableKey>>): Promise<Bot> {
  const supabase = getSupabase();
  const updates: Record<string, unknown> = { updated_at: nowEpoch() };
  for (const key of UPDATABLE) {
    const v = patch[key];
    if (v !== undefined) updates[key] = v;
  }

  await supabase.from("bots").update(updates).eq("id", id);
  const bot = await getBotByIdAsync(id);
  if (!bot) throw new Error("Bot not found");
  return bot;
}

export async function deleteBot(id: number): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("chunks").delete().eq("bot_id", id);
  await supabase.from("documents").delete().eq("bot_id", id);
  await supabase.from("prompts").delete().eq("bot_id", id);
  await supabase.from("support_requests").delete().eq("bot_id", id);
  await supabase.from("conversations").delete().eq("bot_id", id);
  await supabase.from("bots").delete().eq("id", id);
}

export function toPublicConfig(bot: Bot): BotPublicConfig {
  let quickStarts: string[] = [];
  try {
    const parsed = JSON.parse(bot.quick_starts);
    if (Array.isArray(parsed)) quickStarts = parsed.filter((q) => typeof q === "string");
  } catch {
    // malformed
  }
  return {
    botKey: bot.public_key,
    name: bot.name,
    greeting: bot.greeting,
    intro: bot.intro,
    placeholder: bot.placeholder,
    primaryColor: bot.primary_color,
    quickStarts,
    voice: {
      enabled: !!bot.voice_enabled,
      stt: !!bot.stt_enabled,
      tts: !!bot.tts_enabled,
      autoplay: !!bot.voice_autoplay,
      handsfree: !!bot.handsfree_enabled,
      language: bot.voice_language || "auto",
    },
  };
}

export function parseTtsVoices(bot: Bot): Record<string, string> {
  try {
    const parsed = JSON.parse(bot.tts_voices || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") out[k.toLowerCase()] = v;
      }
      return out;
    }
  } catch {
    // malformed
  }
  return {};
}

export function effectiveModel(bot: Bot): string {
  return bot.model || getSetting("default_model");
}

export function serializeBot(bot: Bot | BotListItem) {
  const counts =
    "doc_count" in bot
      ? {
          docCount: bot.doc_count,
          conversationCount: bot.conversation_count,
          newSupportCount: bot.new_support_count,
        }
      : {};
  return {
    id: bot.id,
    slug: bot.slug,
    publicKey: bot.public_key,
    name: bot.name,
    greeting: bot.greeting,
    intro: bot.intro,
    placeholder: bot.placeholder,
    primaryColor: bot.primary_color,
    quickStarts: toPublicConfig(bot).quickStarts,
    model: bot.model,
    activePromptId: bot.active_prompt_id,
    voiceEnabled: !!bot.voice_enabled,
    sttEnabled: !!bot.stt_enabled,
    ttsEnabled: !!bot.tts_enabled,
    voiceAutoplay: !!bot.voice_autoplay,
    handsfreeEnabled: !!bot.handsfree_enabled,
    voiceLanguage: bot.voice_language || "auto",
    ttsVoices: parseTtsVoices(bot),
    replyInUserLanguage: !!bot.reply_in_user_language,
    createdAt: bot.created_at,
    updatedAt: bot.updated_at,
    ...counts,
  };
}

export type SerializedBot = ReturnType<typeof serializeBot>;

export function isValidHslTriple(value: string): boolean {
  return /^\d{1,3}(\.\d+)?\s+\d{1,3}(\.\d+)?%\s+\d{1,3}(\.\d+)?%$/.test(value.trim());
}
