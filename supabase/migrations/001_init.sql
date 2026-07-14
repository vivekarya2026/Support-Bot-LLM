-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
  id            SERIAL PRIMARY KEY,
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
  created_at    INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  updated_at    INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
);

-- Prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id         SERIAL PRIMARY KEY,
  bot_id     INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  updated_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
);
CREATE INDEX IF NOT EXISTS idx_prompts_bot ON prompts(bot_id);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id         SERIAL PRIMARY KEY,
  bot_id     INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  source     TEXT NOT NULL,
  kind       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
);
CREATE INDEX IF NOT EXISTS idx_documents_bot ON documents(bot_id);

-- Chunks table (with embedding vector column for pgvector)
CREATE TABLE IF NOT EXISTS chunks (
  id          SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  bot_id      INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(384)
);
CREATE INDEX IF NOT EXISTS idx_chunks_bot ON chunks(bot_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);

-- HNSW index for fast vector similarity search partitioned by bot_id
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks
  USING hnsw (embedding vector_cosine_ops);

-- Settings table (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  bot_id     INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  updated_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  model      TEXT,
  title      TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversations_bot ON conversations(bot_id, updated_at);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  citations       TEXT,
  created_at      INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
);
CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id, id);

-- Support requests table
CREATE TABLE IF NOT EXISTS support_requests (
  id              SERIAL PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  bot_id          INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new',
  created_at      INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
);
CREATE INDEX IF NOT EXISTS idx_support_bot ON support_requests(bot_id, created_at);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(384),
  match_bot_id INTEGER,
  match_count INTEGER DEFAULT 4
) RETURNS TABLE (
  id INTEGER,
  source TEXT,
  chunk_index INTEGER,
  content TEXT,
  distance FLOAT
) AS $$
  SELECT c.id, c.source, c.chunk_index, c.content,
         (c.embedding <=> query_embedding) AS distance
  FROM chunks c
  WHERE c.bot_id = match_bot_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql;
