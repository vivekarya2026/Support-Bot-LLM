export type ProviderId =
  | "openrouter"
  | "openai"
  | "gemini"
  | "groq"
  | "together"
  | "lmstudio"
  | "custom";

export type ProviderPreset = {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  keyHint: string;
  keyRequired: boolean;
  supportsListModels: boolean;
  fallbackModels: { id: string; label: string }[];
};

export const PROVIDERS: ProviderPreset[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    keyHint: "sk-or-…",
    keyRequired: true,
    supportsListModels: true,
    fallbackModels: [
      { id: "anthropic/claude-sonnet-4.5", label: "Claude (Sonnet 4.5)" },
      { id: "nousresearch/hermes-3-llama-3.1-405b", label: "Hermes 3 (405B)" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    keyHint: "sk-…",
    keyRequired: true,
    supportsListModels: true,
    fallbackModels: [
      { id: "gpt-4o-mini", label: "gpt-4o-mini" },
      { id: "gpt-4o", label: "gpt-4o" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    keyHint: "AIza…",
    keyRequired: true,
    supportsListModels: false,
    fallbackModels: [
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
      { id: "gemini-2.5-pro", label: "gemini-2.5-pro" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    keyHint: "gsk_…",
    keyRequired: true,
    supportsListModels: true,
    fallbackModels: [
      { id: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile" },
    ],
  },
  {
    id: "together",
    label: "Together AI",
    defaultBaseUrl: "https://api.together.xyz/v1",
    keyHint: "…",
    keyRequired: true,
    supportsListModels: true,
    fallbackModels: [],
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
    keyHint: "lm-studio (or your configured key)",
    keyRequired: false,
    supportsListModels: true,
    fallbackModels: [],
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    defaultBaseUrl: "",
    keyHint: "…",
    keyRequired: false,
    supportsListModels: true,
    fallbackModels: [],
  },
];

export function findProviderByBaseUrl(baseUrl: string): ProviderPreset | undefined {
  if (!baseUrl) return undefined;
  const normalized = baseUrl.replace(/\/+$/, "");
  return PROVIDERS.find(
    (p) => p.id !== "custom" && p.defaultBaseUrl.replace(/\/+$/, "") === normalized
  );
}

export const DEFAULT_MODELS = PROVIDERS.find((p) => p.id === "openrouter")!.fallbackModels;
