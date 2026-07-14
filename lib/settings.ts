import { getDb } from "./db";

/**
 * Global, instance-wide settings (one operator, one LLM account).
 * Everything a white-label customer sees lives per-bot on the bots table;
 * system prompts live in the prompts table (see lib/prompts.ts).
 */
export type SettingKey =
  | "openrouter_api_key"
  | "openrouter_base_url"
  | "default_model"
  | "tavily_api_key"
  | "voice_service_url";

export type Settings = {
  openrouter_api_key: string;
  openrouter_base_url: string;
  default_model: string;
  tavily_api_key: string;
  voice_service_url: string;
};

const ENV_FALLBACK: Record<SettingKey, () => string | undefined> = {
  openrouter_api_key: () => process.env.OPENROUTER_API_KEY,
  openrouter_base_url: () => process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  default_model: () => "anthropic/claude-sonnet-4.5",
  tavily_api_key: () => process.env.TAVILY_API_KEY,
  voice_service_url: () => process.env.VOICE_SERVICE_URL ?? "http://127.0.0.1:8078",
};

export function getSetting(key: SettingKey): string {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  if (row?.value) return row.value;
  return ENV_FALLBACK[key]() ?? "";
}

export function getAllSettings(): Settings {
  return {
    openrouter_api_key: getSetting("openrouter_api_key"),
    openrouter_base_url: getSetting("openrouter_base_url"),
    default_model: getSetting("default_model"),
    tavily_api_key: getSetting("tavily_api_key"),
    voice_service_url: getSetting("voice_service_url"),
  };
}

export function setSetting(key: SettingKey, value: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function setSettings(values: Partial<Settings>): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const tx = db.transaction((entries: [string, string][]) => {
    for (const [k, v] of entries) stmt.run(k, v);
  });
  tx(Object.entries(values).filter(([, v]) => v !== undefined) as [string, string][]);
}

export function getRedactedSettings(): Settings & {
  openrouter_api_key_set: boolean;
  tavily_api_key_set: boolean;
} {
  const s = getAllSettings();
  return {
    ...s,
    openrouter_api_key: s.openrouter_api_key ? "•".repeat(10) + s.openrouter_api_key.slice(-4) : "",
    openrouter_api_key_set: Boolean(s.openrouter_api_key),
    tavily_api_key: s.tavily_api_key ? "•".repeat(10) + s.tavily_api_key.slice(-4) : "",
    tavily_api_key_set: Boolean(s.tavily_api_key),
  };
}
