import { getDb } from "./db";
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

export function createConversation(botId: number, model: string): string {
  const db = getDb();
  const id = randomUUID();
  db.prepare(`INSERT INTO conversations (id, bot_id, model) VALUES (?, ?, ?)`).run(id, botId, model);
  return id;
}

/** A conversation id belonging to a different bot is ignored — new conversation instead. */
export function ensureConversation(
  botId: number,
  id: string | null | undefined,
  model: string
): string {
  if (!id) return createConversation(botId, model);
  const db = getDb();
  const row = db.prepare(`SELECT id, bot_id FROM conversations WHERE id = ?`).get(id) as
    | { id: string; bot_id: number | null }
    | undefined;
  if (!row || row.bot_id !== botId) return createConversation(botId, model);
  db.prepare(`UPDATE conversations SET updated_at = unixepoch(), model = ? WHERE id = ?`).run(
    model,
    id
  );
  return id;
}

export function appendMessage(
  conversationId: string,
  role: Role,
  content: string,
  citations?: unknown
): number {
  const db = getDb();
  const info = db
    .prepare(`INSERT INTO messages (conversation_id, role, content, citations) VALUES (?, ?, ?, ?)`)
    .run(conversationId, role, content, citations ? JSON.stringify(citations) : null);
  db.prepare(`UPDATE conversations SET updated_at = unixepoch() WHERE id = ?`).run(conversationId);

  // Set title from the first user message if not set
  if (role === "user") {
    const row = db
      .prepare(`SELECT title FROM conversations WHERE id = ?`)
      .get(conversationId) as { title: string | null } | undefined;
    if (row && !row.title) {
      const title = content.slice(0, 80) + (content.length > 80 ? "…" : "");
      db.prepare(`UPDATE conversations SET title = ? WHERE id = ?`).run(title, conversationId);
    }
  }

  return Number(info.lastInsertRowid);
}

/** A message only if its conversation belongs to the given bot (used by /api/tts). */
export function getMessageForBot(messageId: number, botId: number): StoredMessage | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT m.id, m.conversation_id, m.role, m.content, m.citations, m.created_at
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = ? AND c.bot_id = ?`
    )
    .get(messageId, botId) as StoredMessage | undefined;
}

export function listConversations(botId: number, limit = 200): ConversationListItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT c.id, c.bot_id, c.started_at, c.updated_at, c.model, c.title,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
       WHERE c.bot_id = ?
       ORDER BY c.updated_at DESC
       LIMIT ?`
    )
    .all(botId, limit) as ConversationListItem[];
}

export function getConversation(id: string): {
  conversation: ConversationListItem | undefined;
  messages: StoredMessage[];
} {
  const db = getDb();
  const conversation = db
    .prepare(
      `SELECT c.id, c.bot_id, c.started_at, c.updated_at, c.model, c.title,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
       WHERE c.id = ?`
    )
    .get(id) as ConversationListItem | undefined;
  const messages = db
    .prepare(
      `SELECT id, conversation_id, role, content, citations, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY id ASC`
    )
    .all(id) as StoredMessage[];
  return { conversation, messages };
}

export function deleteConversation(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
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

export function createSupportRequest(input: {
  botId: number;
  conversationId: string | null;
  email: string;
  message: string;
}): SupportRequest {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO support_requests (bot_id, conversation_id, email, message) VALUES (?, ?, ?, ?)`
    )
    .run(input.botId, input.conversationId, input.email, input.message);
  const id = Number(info.lastInsertRowid);
  return db.prepare(`SELECT * FROM support_requests WHERE id = ?`).get(id) as SupportRequest;
}

export function listSupportRequests(botId: number): SupportRequest[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM support_requests WHERE bot_id = ? ORDER BY created_at DESC`)
    .all(botId) as SupportRequest[];
}

export function getSupportRequest(botId: number, id: number): SupportRequest | undefined {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM support_requests WHERE id = ? AND bot_id = ?`)
    .get(id, botId) as SupportRequest | undefined;
}

export function updateSupportStatus(
  botId: number,
  id: number,
  status: SupportRequest["status"]
): boolean {
  const db = getDb();
  const info = db
    .prepare(`UPDATE support_requests SET status = ? WHERE id = ? AND bot_id = ?`)
    .run(status, id, botId);
  return info.changes > 0;
}
