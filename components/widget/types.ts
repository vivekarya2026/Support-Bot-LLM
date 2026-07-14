/** Client-safe widget types — no imports from server-only modules. */

export type WidgetVoiceConfig = {
  enabled: boolean;
  stt: boolean;
  tts: boolean;
  autoplay: boolean;
  handsfree: boolean;
  language: string; // 'auto' | ISO 639-1
};

export type WidgetConfig = {
  botKey: string;
  name: string;
  greeting: string;
  intro: string;
  placeholder: string;
  primaryColor: string;
  quickStarts: string[];
  // Optional so older serialized configs keep compiling; absent = voice off.
  voice?: WidgetVoiceConfig;
};

export type Role = "user" | "assistant";

export type Citation = { n: number; source: string; chunkIndex: number; preview: string };

export type Message = {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
  followups?: string[];
  streaming?: boolean;
  /** DB row id of the persisted assistant reply (from the `message` SSE event) — used for TTS. */
  serverId?: number;
  /** Detected spoken language for this turn (ISO 639-1), when it arrived by voice. */
  language?: string;
  // UI-only markers, never sent to /api/chat:
  // "note" = confirmation ribbon, "error" = failed turn with inline Retry
  kind?: "note" | "error";
  retryText?: string;
};
