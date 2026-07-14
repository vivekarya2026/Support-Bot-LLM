import { getDb } from "./db";
import { getBotById } from "./bots";
import { getTemplate, GENERIC_TEMPLATE_ID } from "./prompt-templates";

export type Prompt = {
  id: number;
  bot_id: number;
  name: string;
  content: string;
  created_at: number;
  updated_at: number;
};

export function listPrompts(botId: number): Prompt[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM prompts WHERE bot_id = ? ORDER BY updated_at DESC, id DESC`)
    .all(botId) as Prompt[];
}

export function getPrompt(botId: number, id: number): Prompt | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM prompts WHERE id = ? AND bot_id = ?`).get(id, botId) as
    | Prompt
    | undefined;
}

export function createPrompt(botId: number, input: { name: string; content: string }): Prompt {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error("Prompt name is required");
  if (!input.content.trim()) throw new Error("Prompt content is required");
  const info = db
    .prepare(`INSERT INTO prompts (bot_id, name, content) VALUES (?, ?, ?)`)
    .run(botId, name, input.content);
  return getPrompt(botId, Number(info.lastInsertRowid))!;
}

export function createPromptFromTemplate(botId: number, templateId: string): Prompt {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);
  const bot = getBotById(botId);
  if (!bot) throw new Error("Bot not found");
  return createPrompt(botId, { name: template.label, content: template.prompt(bot.name) });
}

export function updatePrompt(
  botId: number,
  id: number,
  patch: { name?: string; content?: string }
): Prompt {
  const db = getDb();
  const existing = getPrompt(botId, id);
  if (!existing) throw new Error("Prompt not found");
  db.prepare(
    `UPDATE prompts SET name = ?, content = ?, updated_at = unixepoch() WHERE id = ? AND bot_id = ?`
  ).run(patch.name?.trim() || existing.name, patch.content ?? existing.content, id, botId);
  return getPrompt(botId, id)!;
}

/** Throws with .code = "active" when attempting to delete the active prompt. */
export function deletePrompt(botId: number, id: number): void {
  const db = getDb();
  const bot = getBotById(botId);
  if (!bot) throw new Error("Bot not found");
  if (bot.active_prompt_id === id) {
    const err = new Error("Cannot delete the active prompt — activate another one first");
    (err as Error & { code?: string }).code = "active";
    throw err;
  }
  db.prepare(`DELETE FROM prompts WHERE id = ? AND bot_id = ?`).run(id, botId);
}

export function activatePrompt(botId: number, id: number): void {
  const db = getDb();
  const prompt = getPrompt(botId, id);
  if (!prompt) throw new Error("Prompt not found");
  db.prepare(`UPDATE bots SET active_prompt_id = ?, updated_at = unixepoch() WHERE id = ?`).run(
    id,
    botId
  );
}

export function duplicatePrompt(botId: number, id: number): Prompt {
  const source = getPrompt(botId, id);
  if (!source) throw new Error("Prompt not found");
  return createPrompt(botId, { name: `Copy of ${source.name}`, content: source.content });
}

/**
 * The prompt the chat route uses. Falls back to the generic template if the
 * bot's active_prompt_id dangles (e.g. row deleted out-of-band).
 */
export function getActivePromptContent(botId: number): string {
  const bot = getBotById(botId);
  if (!bot) throw new Error("Bot not found");
  if (bot.active_prompt_id) {
    const prompt = getPrompt(botId, bot.active_prompt_id);
    if (prompt) return prompt.content;
  }
  const fallback = listPrompts(botId)[0];
  if (fallback) return fallback.content;
  return getTemplate(GENERIC_TEMPLATE_ID)!.prompt(bot.name);
}
