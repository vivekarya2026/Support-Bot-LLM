import { getSupabase, nowEpoch } from "./supabase";

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
  // On serverless, prefer env vars directly for speed (avoids a DB round-trip)
  const envVal = ENV_FALLBACK[key]();
  if (envVal) return envVal;
  return "";
}

export async function getSettingAsync(key: SettingKey): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .single();
  if (data?.value) return data.value;
  return ENV_FALLBACK[key]() ?? "";
}

export async function getAllSettingsAsync(): Promise<Settings> {
  const supabase = getSupabase();
  const { data } = await supabase.from("settings").select("key, value");

  const dbMap: Record<string, string> = {};
  if (data) {
    for (const row of data) dbMap[row.key] = row.value;
  }

  const resolve = (key: SettingKey): string =>
    dbMap[key] || ENV_FALLBACK[key]() || "";

  return {
    openrouter_api_key: resolve("openrouter_api_key"),
    openrouter_base_url: resolve("openrouter_base_url"),
    default_model: resolve("default_model"),
    tavily_api_key: resolve("tavily_api_key"),
    voice_service_url: resolve("voice_service_url"),
  };
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

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("settings").upsert({ key, value }, { onConflict: "key" });
}

export async function setSettings(values: Partial<Settings>): Promise<void> {
  const supabase = getSupabase();
  const rows = Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value: value! }));
  if (rows.length > 0) {
    await supabase.from("settings").upsert(rows, { onConflict: "key" });
  }
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

export async function getRedactedSettingsAsync(): Promise<
  Settings & { openrouter_api_key_set: boolean; tavily_api_key_set: boolean }
> {
  const s = await getAllSettingsAsync();
  return {
    ...s,
    openrouter_api_key: s.openrouter_api_key ? "•".repeat(10) + s.openrouter_api_key.slice(-4) : "",
    openrouter_api_key_set: Boolean(s.openrouter_api_key),
    tavily_api_key: s.tavily_api_key ? "•".repeat(10) + s.tavily_api_key.slice(-4) : "",
    tavily_api_key_set: Boolean(s.tavily_api_key),
  };
}
