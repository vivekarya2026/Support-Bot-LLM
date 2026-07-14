import { getSupabase, nowEpoch } from "./supabase";
import { randomUUID } from "node:crypto";

export type Role = "user" | "assistant" | "system";

export type ConversationListItem = {
  id: string;
  bot_id: number | null;
  started_at: number;
  updated_at: number;
  model: string | null;
  title: string | null;
  message_count: number;
};

export type StoredMessage = {
  id: number;
  conversation_id: string;
  role: Role;
  content: string;
  citations: string | null;
  created_at: number;
};

export async function createConversation(botId: number, model: string): Promise<string> {
  const supabase = getSupabase();
  const id = randomUUID();
  const now = nowEpoch();
  await supabase.from("conversations").insert({
    id,
    bot_id: botId,
    model,
    started_at: now,
    updated_at: now,
  });
  return id;
}

export async function ensureConversation(
  botId: number,
  id: string | null | undefined,
  model: string
): Promise<string> {
  if (!id) return createConversation(botId, model);
  const supabase = getSupabase();
  const { data: row } = await supabase
    .from("conversations")
    .select("id, bot_id")
    .eq("id", id)
    .single();
  if (!row || row.bot_id !== botId) return createConversation(botId, model);
  await supabase
    .from("conversations")
    .update({ updated_at: nowEpoch(), model })
    .eq("id", id);
  return id;
}

export async function appendMessage(
  conversationId: string,
  role: Role,
  content: string,
  citations?: unknown
): Promise<number> {
  const supabase = getSupabase();
  const now = nowEpoch();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      citations: citations ? JSON.stringify(citations) : null,
      created_at: now,
    })
    .select("id")
    .single();

  await supabase
    .from("conversations")
    .update({ updated_at: now })
    .eq("id", conversationId);

  if (role === "user") {
    const { data: convo } = await supabase
      .from("conversations")
      .select("title")
      .eq("id", conversationId)
      .single();
    if (convo && !convo.title) {
      const title = content.slice(0, 80) + (content.length > 80 ? "…" : "");
      await supabase
        .from("conversations")
        .update({ title })
        .eq("id", conversationId);
    }
  }

  return data?.id ?? 0;
}

export async function getMessageForBot(
  messageId: number,
  botId: number
): Promise<StoredMessage | undefined> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, citations, created_at, conversations!inner(bot_id)")
    .eq("id", messageId)
    .eq("conversations.bot_id", botId)
    .single();

  if (!data) return undefined;
  return {
    id: data.id,
    conversation_id: data.conversation_id,
    role: data.role as Role,
    content: data.content,
    citations: data.citations,
    created_at: data.created_at,
  };
}

export async function listConversations(
  botId: number,
  limit = 200
): Promise<ConversationListItem[]> {
  const supabase = getSupabase();
  const { data: convos } = await supabase
    .from("conversations")
    .select("id, bot_id, started_at, updated_at, model, title")
    .eq("bot_id", botId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!convos) return [];

  const results: ConversationListItem[] = [];
  for (const c of convos) {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", c.id);
    results.push({ ...c, message_count: count ?? 0 });
  }
  return results;
}

export async function getConversation(id: string): Promise<{
  conversation: ConversationListItem | undefined;
  messages: StoredMessage[];
}> {
  const supabase = getSupabase();

  const { data: convo } = await supabase
    .from("conversations")
    .select("id, bot_id, started_at, updated_at, model, title")
    .eq("id", id)
    .single();

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, citations, created_at")
    .eq("conversation_id", id)
    .order("id", { ascending: true });

  let conversation: ConversationListItem | undefined;
  if (convo) {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", id);
    conversation = { ...convo, message_count: count ?? 0 };
  }

  return {
    conversation,
    messages: (msgs ?? []) as StoredMessage[],
  };
}

export async function deleteConversation(id: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("conversations").delete().eq("id", id);
}

// --- Support requests ---

export type SupportRequest = {
  id: number;
  conversation_id: string | null;
  bot_id: number | null;
  email: string;
  message: string;
  status: "new" | "in_progress" | "resolved";
  created_at: number;
};

export async function createSupportRequest(input: {
  botId: number;
  conversationId: string | null;
  email: string;
  message: string;
}): Promise<SupportRequest> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      bot_id: input.botId,
      conversation_id: input.conversationId,
      email: input.email,
      message: input.message,
      created_at: nowEpoch(),
    })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to create support request: ${error?.message}`);
  return data as SupportRequest;
}

export async function listSupportRequests(botId: number): Promise<SupportRequest[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("support_requests")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });
  return (data ?? []) as SupportRequest[];
}

export async function getSupportRequest(
  botId: number,
  id: number
): Promise<SupportRequest | undefined> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("support_requests")
    .select("*")
    .eq("id", id)
    .eq("bot_id", botId)
    .single();
  return data ?? undefined;
}

export async function updateSupportStatus(
  botId: number,
  id: number,
  status: SupportRequest["status"]
): Promise<boolean> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from("support_requests")
    .update({ status }, { count: "exact" })
    .eq("id", id)
    .eq("bot_id", botId);
  return (count ?? 0) > 0;
}
