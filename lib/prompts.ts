import { getSupabase, nowEpoch } from "./supabase";
import { getBotByIdAsync } from "./bots";
import { getTemplate, GENERIC_TEMPLATE_ID } from "./prompt-templates";

export type Prompt = {
  id: number;
  bot_id: number;
  name: string;
  content: string;
  created_at: number;
  updated_at: number;
};

export async function listPrompts(botId: number): Promise<Prompt[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("prompts")
    .select("*")
    .eq("bot_id", botId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });
  return (data ?? []) as Prompt[];
}

export async function getPrompt(botId: number, id: number): Promise<Prompt | undefined> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("prompts")
    .select("*")
    .eq("id", id)
    .eq("bot_id", botId)
    .single();
  return data ?? undefined;
}

export async function createPrompt(
  botId: number,
  input: { name: string; content: string }
): Promise<Prompt> {
  const supabase = getSupabase();
  const name = input.name.trim();
  if (!name) throw new Error("Prompt name is required");
  if (!input.content.trim()) throw new Error("Prompt content is required");

  const now = nowEpoch();
  const { data, error } = await supabase
    .from("prompts")
    .insert({ bot_id: botId, name, content: input.content, created_at: now, updated_at: now })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to create prompt: ${error?.message}`);
  return data as Prompt;
}

export async function createPromptFromTemplate(botId: number, templateId: string): Promise<Prompt> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);
  const bot = await getBotByIdAsync(botId);
  if (!bot) throw new Error("Bot not found");
  return createPrompt(botId, { name: template.label, content: template.prompt(bot.name) });
}

export async function updatePrompt(
  botId: number,
  id: number,
  patch: { name?: string; content?: string }
): Promise<Prompt> {
  const supabase = getSupabase();
  const existing = await getPrompt(botId, id);
  if (!existing) throw new Error("Prompt not found");

  await supabase
    .from("prompts")
    .update({
      name: patch.name?.trim() || existing.name,
      content: patch.content ?? existing.content,
      updated_at: nowEpoch(),
    })
    .eq("id", id)
    .eq("bot_id", botId);

  return (await getPrompt(botId, id))!;
}

export async function deletePrompt(botId: number, id: number): Promise<void> {
  const bot = await getBotByIdAsync(botId);
  if (!bot) throw new Error("Bot not found");
  if (bot.active_prompt_id === id) {
    const err = new Error("Cannot delete the active prompt — activate another one first");
    (err as Error & { code?: string }).code = "active";
    throw err;
  }
  const supabase = getSupabase();
  await supabase.from("prompts").delete().eq("id", id).eq("bot_id", botId);
}

export async function activatePrompt(botId: number, id: number): Promise<void> {
  const prompt = await getPrompt(botId, id);
  if (!prompt) throw new Error("Prompt not found");
  const supabase = getSupabase();
  await supabase
    .from("bots")
    .update({ active_prompt_id: id, updated_at: nowEpoch() })
    .eq("id", botId);
}

export async function duplicatePrompt(botId: number, id: number): Promise<Prompt> {
  const source = await getPrompt(botId, id);
  if (!source) throw new Error("Prompt not found");
  return createPrompt(botId, { name: `Copy of ${source.name}`, content: source.content });
}

export async function getActivePromptContent(botId: number): Promise<string> {
  const bot = await getBotByIdAsync(botId);
  if (!bot) throw new Error("Bot not found");
  if (bot.active_prompt_id) {
    const prompt = await getPrompt(botId, bot.active_prompt_id);
    if (prompt) return prompt.content;
  }
  const prompts = await listPrompts(botId);
  if (prompts[0]) return prompts[0].content;
  return getTemplate(GENERIC_TEMPLATE_ID)!.prompt(bot.name);
}
