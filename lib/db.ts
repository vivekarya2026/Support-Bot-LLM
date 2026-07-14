import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { EMBEDDING_DIM } from "./embeddings";

// On serverless hosts (Vercel) the project directory is read-only; fall back
// to /tmp. That makes hosted demos boot, but the DB is EPHEMERAL there — real
// deployments should run on a persistent host (see README "Deploying").
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "supportkit-data")
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "vectors.db");

let dbInstance: Database.Database | null = null;

export function generatePublicKey(): string {
  return "pk_" + randomBytes(9).toString("base64url");
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  sqliteVec.load(db);
  db.pragma("foreign_keys = ON");

  createBaseTables(db);
  migrateToV1(db);
  migrateToV2(db);

  dbInstance = db;
  return db;
}

/**
 * v1 schema. CREATE IF NOT EXISTS everywhere, so fresh DBs get the v1 shape
 * directly and legacy DBs keep their old shape until migrateToV1 alters them.
 * bot_id columns are plain INTEGERs (SQLite ALTER can't add FK columns, so
 * fresh installs match the migrated shape); ownership is enforced in lib code.
 */
function createBaseTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT NOT NULL UNIQUE,
      public_key    TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      greeting      TEXT NOT NULL DEFAULT '',
      intro         TEXT NOT NULL DEFAULT '',
      placeholder   TEXT NOT NULL DEFAULT 'Ask me anything…',
      primary_color TEXT NOT NULL DEFAULT '217 91% 60%',
      quick_starts  TEXT NOT NULL DEFAULT '[]',
      model         TEXT NOT NULL DEFAULT '',
      active_prompt_id INTEGER,
      voice_enabled          INTEGER NOT NULL DEFAULT 0,
      stt_enabled            INTEGER NOT NULL DEFAULT 1,
      tts_enabled            INTEGER NOT NULL DEFAULT 1,
      voice_autoplay         INTEGER NOT NULL DEFAULT 0,
      handsfree_enabled      INTEGER NOT NULL DEFAULT 0,
      voice_language         TEXT    NOT NULL DEFAULT 'auto',
      tts_voices             TEXT    NOT NULL DEFAULT '{}',
      reply_in_user_language INTEGER NOT NULL DEFAULT 1,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id     INTEGER NOT NULL,
      name       TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_prompts_bot ON prompts(bot_id);

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER,
      source TEXT NOT NULL,
      kind   TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER,
      bot_id INTEGER,
      source TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0(
      bot_id    INTEGER PARTITION KEY,
      embedding float[${EMBEDDING_DIM}]
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      bot_id      INTEGER,
      started_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      model       TEXT,
      title       TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id, id);

    CREATE TABLE IF NOT EXISTS support_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT,
      bot_id INTEGER,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    );
  `);
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

/**
 * Legacy (pre-workspace) content used to be hardcoded in the widget and the
 * default system prompt. A migrated DB gets one editable bot carrying those
 * exact strings so behavior is identical after upgrade.
 */
const LEGACY_BOT = {
  slug: "default",
  name: "AgentPay Assistant",
  greeting: "Hi! I'm the AgentPay assistant.",
  intro:
    "Ask me anything about pricing, integration, security, or how the platform works. I'll cite my sources so you can verify.",
  placeholder: "Ask about pricing, integration, anything…",
  quickStarts: ["What is AgentPay?", "How does pricing work?", "How do I integrate it?"],
  prompt: `You are the AgentPay support assistant.

Your job: answer questions about AgentPay accurately and concisely, using ONLY the context provided below. AgentPay is a payment infrastructure for AI agents.

Rules:
- If the context doesn't contain the answer, say so plainly — do not invent facts.
- When you cite a fact, reference the source like [1] or [2] matching the numbered context entries.
- Keep answers short (3–6 sentences) unless the user asks for detail.
- If the user asks something off-topic (not about AgentPay), politely redirect.`,
};

function migrateToV1(db: Database.Database): void {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version >= 1) return;

  const migrate = db.transaction(() => {
    // Add bot_id to legacy tables (no-op on fresh v1 tables).
    for (const table of ["documents", "chunks", "conversations", "support_requests"]) {
      if (!hasColumn(db, table, "bot_id")) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN bot_id INTEGER`);
      }
    }

    // Legacy data → one default bot carrying the previously hardcoded branding.
    const botCount = (db.prepare(`SELECT COUNT(*) AS c FROM bots`).get() as { c: number }).c;
    const legacyRows =
      (db.prepare(`SELECT COUNT(*) AS c FROM documents`).get() as { c: number }).c +
      (db.prepare(`SELECT COUNT(*) AS c FROM conversations`).get() as { c: number }).c +
      (db.prepare(`SELECT COUNT(*) AS c FROM support_requests`).get() as { c: number }).c;

    let defaultBotId: number | null = null;
    if (botCount === 0 && legacyRows > 0) {
      const info = db
        .prepare(
          `INSERT INTO bots (slug, public_key, name, greeting, intro, placeholder, quick_starts)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          LEGACY_BOT.slug,
          generatePublicKey(),
          LEGACY_BOT.name,
          LEGACY_BOT.greeting,
          LEGACY_BOT.intro,
          LEGACY_BOT.placeholder,
          JSON.stringify(LEGACY_BOT.quickStarts)
        );
      defaultBotId = Number(info.lastInsertRowid);

      // The system prompt used to live in settings (falling back to a hardcoded
      // default). Either way it becomes the bot's first, active prompt.
      const stored = db
        .prepare(`SELECT value FROM settings WHERE key = 'system_prompt'`)
        .get() as { value: string } | undefined;
      const promptInfo = db
        .prepare(`INSERT INTO prompts (bot_id, name, content) VALUES (?, ?, ?)`)
        .run(defaultBotId, "Default prompt", stored?.value || LEGACY_BOT.prompt);
      db.prepare(`UPDATE bots SET active_prompt_id = ? WHERE id = ?`).run(
        Number(promptInfo.lastInsertRowid),
        defaultBotId
      );
    }
    db.prepare(`DELETE FROM settings WHERE key = 'system_prompt'`).run();

    if (defaultBotId !== null) {
      db.prepare(`UPDATE documents SET bot_id = ? WHERE bot_id IS NULL`).run(defaultBotId);
      db.prepare(
        `UPDATE chunks SET bot_id = (SELECT d.bot_id FROM documents d WHERE d.id = chunks.document_id)
         WHERE bot_id IS NULL`
      ).run();
      db.prepare(`UPDATE chunks SET bot_id = ? WHERE bot_id IS NULL`).run(defaultBotId);
      db.prepare(`UPDATE conversations SET bot_id = ? WHERE bot_id IS NULL`).run(defaultBotId);
      db.prepare(`UPDATE support_requests SET bot_id = ? WHERE bot_id IS NULL`).run(defaultBotId);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_documents_bot ON documents(bot_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_bot ON chunks(bot_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_bot ON conversations(bot_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_support_bot ON support_requests(bot_id, created_at);
    `);
  });
  migrate();

  // vec0 tables can't be ALTERed, so a legacy (un-partitioned) chunk_vectors is
  // rebuilt once, copying embedding blobs — no re-embedding. Kept outside the
  // transaction: virtual-table DDL inside explicit transactions is unreliable.
  const vecSql = (
    db
      .prepare(`SELECT sql FROM sqlite_master WHERE name = 'chunk_vectors'`)
      .get() as { sql: string } | undefined
  )?.sql;
  if (vecSql && !/partition\s+key/i.test(vecSql)) {
    db.exec(`
      CREATE TEMP TABLE _vec_backup AS
        SELECT v.rowid AS id, c.bot_id AS bot_id, v.embedding AS embedding
        FROM chunk_vectors v JOIN chunks c ON c.id = v.rowid;
      DROP TABLE chunk_vectors;
      CREATE VIRTUAL TABLE chunk_vectors USING vec0(
        bot_id    INTEGER PARTITION KEY,
        embedding float[${EMBEDDING_DIM}]
      );
      INSERT INTO chunk_vectors (rowid, bot_id, embedding)
        SELECT id, bot_id, embedding FROM _vec_backup;
      DROP TABLE _vec_backup;
    `);
  }

  db.pragma("user_version = 1");
}

/**
 * v2: per-bot voice module settings. Plain ADD COLUMN with constant defaults;
 * existing bots come out with voice disabled.
 */
function migrateToV2(db: Database.Database): void {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version >= 2) return;

  const VOICE_COLUMNS: [string, string][] = [
    ["voice_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["stt_enabled", "INTEGER NOT NULL DEFAULT 1"],
    ["tts_enabled", "INTEGER NOT NULL DEFAULT 1"],
    ["voice_autoplay", "INTEGER NOT NULL DEFAULT 0"],
    ["handsfree_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["voice_language", "TEXT NOT NULL DEFAULT 'auto'"],
    ["tts_voices", "TEXT NOT NULL DEFAULT '{}'"],
    ["reply_in_user_language", "INTEGER NOT NULL DEFAULT 1"],
  ];

  const migrate = db.transaction(() => {
    for (const [name, def] of VOICE_COLUMNS) {
      if (!hasColumn(db, "bots", name)) {
        db.exec(`ALTER TABLE bots ADD COLUMN ${name} ${def}`);
      }
    }
  });
  migrate();

  db.pragma("user_version = 2");
}

/** Wipe one bot's knowledge base: vectors (by rowid), chunks, documents. */
export function resetBotKnowledge(botId: number): { documents: number; chunks: number } {
  const db = getDb();
  const tx = db.transaction((id: number) => {
    const chunkIds = db
      .prepare(`SELECT id FROM chunks WHERE bot_id = ?`)
      .all(id) as { id: number }[];
    const delVec = db.prepare(`DELETE FROM chunk_vectors WHERE rowid = ?`);
    for (const { id: cid } of chunkIds) delVec.run(BigInt(cid));
    const chunks = db.prepare(`DELETE FROM chunks WHERE bot_id = ?`).run(id).changes;
    const documents = db.prepare(`DELETE FROM documents WHERE bot_id = ?`).run(id).changes;
    return { documents, chunks };
  });
  return tx(botId);
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
