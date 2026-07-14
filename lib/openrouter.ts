import OpenAI from "openai";
import { getAllSettingsAsync } from "./settings";

export { DEFAULT_MODELS } from "./providers";

export async function getOpenRouter(): Promise<OpenAI> {
  const { openrouter_api_key, openrouter_base_url } = await getAllSettingsAsync();
  if (!openrouter_api_key) {
    throw new Error(
      "LLM API key is not set. Add it in the admin Settings page or .env.local."
    );
  }
  return new OpenAI({
    apiKey: openrouter_api_key,
    baseURL: openrouter_base_url || "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "SupportKit",
    },
  });
}
