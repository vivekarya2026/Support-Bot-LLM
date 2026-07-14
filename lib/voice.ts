import { getSetting } from "./settings";
import type { Bot } from "./bots";
import { parseTtsVoices } from "./bots";

/**
 * Server-side client for the loopback voice sidecar (voice-service/).
 * Browsers never talk to the sidecar directly — the /api/stt, /api/tts and
 * /api/voice/health routes proxy through here, so botKey validation and
 * per-bot flags stay in one place.
 */

export type VoiceHealth = {
  ok: boolean;
  stt: { model: string; loaded: boolean };
  tts: { engine: string; loaded: boolean; languages: string[]; error?: string };
};

export type Voice = {
  id: string;
  engine: string;
  language: string;
  name: string;
  license: string;
};

export function getVoiceServiceUrl(): string {
  return getSetting("voice_service_url").trim().replace(/\/+$/, "");
}

export function voiceGloballyEnabled(): boolean {
  return getVoiceServiceUrl().length > 0;
}

// -- health (cached: widget mounts must not hammer the sidecar) --------------

const HEALTH_TTL_MS = 30_000;
const HEALTH_FAILURE_TTL_MS = 10_000;
let healthCache: { result: VoiceHealth | null; ts: number } | null = null;

export async function checkVoiceHealth(): Promise<VoiceHealth | null> {
  const url = getVoiceServiceUrl();
  if (!url) return null;

  const now = Date.now();
  if (healthCache) {
    const ttl = healthCache.result ? HEALTH_TTL_MS : HEALTH_FAILURE_TTL_MS;
    if (now - healthCache.ts < ttl) return healthCache.result;
  }

  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
    const result = res.ok ? ((await res.json()) as VoiceHealth) : null;
    healthCache = { result, ts: now };
    return result;
  } catch {
    healthCache = { result: null, ts: now };
    return null;
  }
}

// -- voice catalog (cached) ---------------------------------------------------

const CATALOG_TTL_MS = 5 * 60_000;
let catalogCache: { voices: Voice[]; ts: number } | null = null;

export async function getVoiceCatalog(): Promise<Voice[]> {
  const url = getVoiceServiceUrl();
  if (!url) return [];
  if (catalogCache && Date.now() - catalogCache.ts < CATALOG_TTL_MS) return catalogCache.voices;
  try {
    const res = await fetch(`${url}/voices`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { voices: Voice[] };
    catalogCache = { voices: data.voices ?? [], ts: Date.now() };
    return catalogCache.voices;
  } catch {
    return [];
  }
}

// -- language / voice resolution ---------------------------------------------

export function normalizeLanguage(code: string | null | undefined): string {
  if (!code) return "";
  let c = code.trim().toLowerCase();
  if (c.includes("-")) c = c.split("-")[0];
  const aliases: Record<string, string> = { hin: "hi", eng: "en", spa: "es", fra: "fr", deu: "de" };
  return aliases[c] ?? c;
}

/**
 * The Node-side half of the language funnel (Whisper ~100 ⊃ engine set):
 * bot's explicit per-language voice → any catalog voice for the language →
 * null, which the /api/tts route turns into a 422 "language_unsupported".
 */
export async function resolveTtsTarget(
  bot: Bot,
  language: string
): Promise<{ language: string; voiceId: string | null } | null> {
  const lang = normalizeLanguage(language) || normalizeLanguage(bot.voice_language) || "en";
  const catalog = await getVoiceCatalog();
  const explicit = parseTtsVoices(bot)[lang];
  if (explicit && catalog.some((v) => v.id === explicit)) {
    return { language: lang, voiceId: explicit };
  }
  const match = catalog.find((v) => v.language === lang);
  if (match) return { language: lang, voiceId: match.id };
  // Catalog empty (sidecar cold/unreachable): let the sidecar decide.
  if (catalog.length === 0) return { language: lang, voiceId: null };
  return null;
}

/** ISO 639-1 → English name, for prompt injection and admin labels. */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  pl: "Polish",
  tr: "Turkish",
  ru: "Russian",
  nl: "Dutch",
  cs: "Czech",
  ar: "Arabic",
  zh: "Chinese",
  ja: "Japanese",
  hu: "Hungarian",
  ko: "Korean",
};

// -- lightweight per-bot rate limiting (no auth exists in this app) -----------

const BUCKET_CAPACITY = 30; // requests
const BUCKET_REFILL_PER_SEC = 0.5; // 1 request every 2s sustained
const buckets = new Map<number, { tokens: number; ts: number }>();

export function takeVoiceToken(botId: number): boolean {
  const now = Date.now();
  const b = buckets.get(botId) ?? { tokens: BUCKET_CAPACITY, ts: now };
  b.tokens = Math.min(BUCKET_CAPACITY, b.tokens + ((now - b.ts) / 1000) * BUCKET_REFILL_PER_SEC);
  b.ts = now;
  if (b.tokens < 1) {
    buckets.set(botId, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(botId, b);
  return true;
}
