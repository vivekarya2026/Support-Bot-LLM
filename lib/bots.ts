import { getDb, generatePublicKey, resetBotKnowledge } from "./db";
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
  quick_starts: string; // JSON string[]
  model: string; // '' = use global default_model
  active_prompt_id: number | null;
  voice_enabled: number; // 0|1 master switch for the voice module
  stt_enabled: number;
  tts_enabled: number;
  voice_autoplay: number; // auto-speak settled replies
  handsfree_enabled: number; // hands-free conversation mode
  voice_language: string; // 'auto' | ISO 639-1
  tts_voices: string; // JSON {lang: voiceId}
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
  language: string; // 'auto' | ISO 639-1
};

/** What visitor-facing surfaces (widget, share page, embed) are allowed to see. */
export type BotPublicConfig = {
  botKey: string;
  name: string;
  greeting: string;
  intro: string;
  placeholder: string;
  primaryColor: string;
  quickStarts: string[];
  // Voice flags + language only — voice IDs resolve server-side in /api/tts.
  voice: BotVoiceConfig;
};

export type BotListItem = Bot & {
  doc_count: number;
  conversation_count: number;
  new_support_count: number;
};

export function listBots(): BotListItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT b.*,
              (SELECT COUNT(*) FROM documents d WHERE d.bot_id = b.id) AS doc_count,
              (SELECT COUNT(*) FROM conversations c WHERE c.bot_id = b.id) AS conversation_count,
              (SELECT COUNT(*) FROM support_requests s WHERE s.bot_id = b.id AND s.status = 'new') AS new_support_count
       FROM bots b
       ORDER BY b.created_at ASC`
    )
    .all() as BotListItem[];
}

export function countBots(): number {
  const db = getDb();
  return (db.prepare(`SELECT COUNT(*) AS c FROM bots`).get() as { c: number }).c;
}

export function getBotBySlug(slug: string): Bot | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM bots WHERE slug = ?`).get(slug) as Bot | undefined;
}

export function getBotByPublicKey(publicKey: string): Bot | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM bots WHERE public_key = ?`).get(publicKey) as Bot | undefined;
}

export function getBotById(id: number): Bot | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM bots WHERE id = ?`).get(id) as Bot | undefined;
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

export function createBot(input: {
  name: string;
  primaryColor?: string;
  greeting?: string;
  intro?: string;
  placeholder?: string;
  quickStarts?: string[];
  templateId?: string;
}): Bot {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error("Bot name is required");

  const template = getTemplate(input.templateId ?? "") ?? getTemplate(GENERIC_TEMPLATE_ID)!;

  let slug = slugify(name);
  for (let i = 2; getBotBySlug(slug); i++) slug = `${slugify(name)}-${i}`;

  const info = db
    .prepare(
      `INSERT INTO bots (slug, public_key, name, greeting, intro, placeholder, primary_color, quick_starts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      slug,
      generatePublicKey(),
      name,
      input.greeting ?? template.greeting(name),
      input.intro ?? template.intro,
      input.placeholder ?? "Ask me anything…",
      input.primaryColor ?? "217 91% 60%",
      JSON.stringify(input.quickStarts ?? template.quickStarts)
    );
  const botId = Number(info.lastInsertRowid);

  const promptInfo = db
    .prepare(`INSERT INTO prompts (bot_id, name, content) VALUES (?, ?, ?)`)
    .run(botId, template.label, template.prompt(name));
  db.prepare(`UPDATE bots SET active_prompt_id = ? WHERE id = ?`).run(
    Number(promptInfo.lastInsertRowid),
    botId
  );

  return getBotById(botId)!;
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

export function updateBot(id: number, patch: Partial<Pick<Bot, UpdatableKey>>): Bot {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of UPDATABLE) {
    const v = patch[key];
    if (v !== undefined) {
      sets.push(`${key} = ?`);
      values.push(v);
    }
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE bots SET ${sets.join(", ")}, updated_at = unixepoch() WHERE id = ?`).run(
      ...values,
      id
    );
  }
  const bot = getBotById(id);
  if (!bot) throw new Error("Bot not found");
  return bot;
}

/** Full cascade: KB (incl. vectors), prompts, conversations (+messages via FK), support requests, bot row. */
export function deleteBot(id: number): void {
  const db = getDb();
  resetBotKnowledge(id);
  const tx = db.transaction((botId: number) => {
    db.prepare(`DELETE FROM prompts WHERE bot_id = ?`).run(botId);
    db.prepare(`DELETE FROM conversations WHERE bot_id = ?`).run(botId);
    db.prepare(`DELETE FROM support_requests WHERE bot_id = ?`).run(botId);
    db.prepare(`DELETE FROM bots WHERE id = ?`).run(botId);
  });
  tx(id);
}

export function toPublicConfig(bot: Bot): BotPublicConfig {
  let quickStarts: string[] = [];
  try {
    const parsed = JSON.parse(bot.quick_starts);
    if (Array.isArray(parsed)) quickStarts = parsed.filter((q) => typeof q === "string");
  } catch {
    // malformed JSON in the column — treat as no quick starts
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

/** Parsed per-language voice map ({lang: voiceId}); malformed JSON = empty. */
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
    // malformed JSON in the column — treat as no explicit voice choices
  }
  return {};
}

export function effectiveModel(bot: Bot): string {
  return bot.model || getSetting("default_model");
}

/** Admin-API shape: camelCase, quick_starts parsed, counts included when present. */
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

/** HSL triple like "217 91% 60%" — the only shape the theming CSS vars accept. */
export function isValidHslTriple(value: string): boolean {
  return /^\d{1,3}(\.\d+)?\s+\d{1,3}(\.\d+)?%\s+\d{1,3}(\.\d+)?%$/.test(value.trim());
}
