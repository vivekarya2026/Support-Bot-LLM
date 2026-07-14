import path from "node:path";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import mammoth from "mammoth";
import { getDb, resetBotKnowledge } from "./db";
import { embed } from "./embeddings";

export type DocumentKind = "md" | "txt" | "pdf" | "docx" | "url";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

/** Sentence-split a paragraph that exceeds CHUNK_SIZE; hard-wrap pathological sentences. */
function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= CHUNK_SIZE) return [paragraph];
  const sentences = paragraph.match(/[^.!?\n]+[.!?]+["')\]]*\s*|[^.!?\n]+\n?/g) ?? [paragraph];
  const parts: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > CHUNK_SIZE && buf.trim()) {
      parts.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.flatMap((part) => {
    if (part.length <= CHUNK_SIZE) return [part];
    const wrapped: string[] = [];
    for (let i = 0; i < part.length; i += CHUNK_SIZE) wrapped.push(part.slice(i, i + CHUNK_SIZE));
    return wrapped;
  });
}

/** Overlap tail snapped to a whitespace boundary so it never cuts mid-word. */
function overlapTail(text: string): string {
  if (text.length <= CHUNK_OVERLAP) return text;
  const tail = text.slice(text.length - CHUNK_OVERLAP);
  const firstSpace = tail.search(/\s/);
  if (firstSpace > 0 && firstSpace < tail.length - 1) return tail.slice(firstSpace + 1);
  return tail;
}

function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap(splitLongParagraph);

  const chunks: string[] = [];
  let buf = "";

  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > CHUNK_SIZE && buf.length > 0) {
      chunks.push(buf);
      buf = overlapTail(buf) + "\n\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.length > 0) chunks.push(buf);
  return chunks;
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

async function parseUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 SupportKit-Indexer" },
  });
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();
  const main = $("main").length ? $("main").html() : $("body").html();
  return turndown.turndown(main ?? "");
}

export type ParsedDocument = {
  kind: DocumentKind;
  source: string;
  text: string;
};

export async function parseFileBuffer(
  filename: string,
  buffer: Buffer
): Promise<ParsedDocument> {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
    return { kind: ext === ".txt" ? "txt" : "md", source: filename, text: buffer.toString("utf-8") };
  }
  if (ext === ".pdf") {
    return { kind: "pdf", source: filename, text: await parsePdf(buffer) };
  }
  if (ext === ".docx") {
    return { kind: "docx", source: filename, text: await parseDocx(buffer) };
  }
  throw new Error(`Unsupported file type: ${ext || "(no extension)"}`);
}

export async function parseUrlInput(url: string): Promise<ParsedDocument> {
  const text = await parseUrl(url);
  return { kind: "url", source: url, text };
}

async function insertChunks(botId: number, documentId: number, source: string, chunks: string[]) {
  const db = getDb();
  const insertChunk = db.prepare(
    `INSERT INTO chunks (document_id, bot_id, source, chunk_index, content) VALUES (?, ?, ?, ?, ?)`
  );
  const insertVector = db.prepare(
    `INSERT INTO chunk_vectors (rowid, bot_id, embedding) VALUES (?, ?, vec_f32(?))`
  );
  for (let i = 0; i < chunks.length; i++) {
    const info = insertChunk.run(documentId, botId, source, i, chunks[i]);
    const rowid = Number(info.lastInsertRowid);
    const vec = await embed(chunks[i]);
    // BigInt binds as a true INTEGER — vec0 partition keys reject the FLOAT
    // that better-sqlite3 uses for plain JS numbers.
    insertVector.run(BigInt(rowid), BigInt(botId), JSON.stringify(Array.from(vec)));
  }
}

/** Index a parsed document into one bot's knowledge base. */
export async function indexDocument(
  botId: number,
  doc: ParsedDocument
): Promise<{ documentId: number; chunkCount: number }> {
  if (!doc.text || doc.text.trim().length === 0) {
    throw new Error("Parsed document is empty");
  }
  const db = getDb();
  const chunks = chunkText(doc.text);

  const info = db
    .prepare(`INSERT INTO documents (bot_id, source, kind) VALUES (?, ?, ?)`)
    .run(botId, doc.source, doc.kind);
  const documentId = Number(info.lastInsertRowid);

  await insertChunks(botId, documentId, doc.source, chunks);
  return { documentId, chunkCount: chunks.length };
}

export type DocumentListItem = {
  id: number;
  source: string;
  kind: DocumentKind;
  created_at: number;
  chunk_count: number;
};

export function listDocuments(botId: number): DocumentListItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT d.id, d.source, d.kind, d.created_at,
              (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count
       FROM documents d
       WHERE d.bot_id = ?
       ORDER BY d.created_at DESC`
    )
    .all(botId) as DocumentListItem[];
}

export function getDocument(botId: number, id: number): DocumentListItem | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT d.id, d.source, d.kind, d.created_at,
              (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count
       FROM documents d WHERE d.id = ? AND d.bot_id = ?`
    )
    .get(id, botId) as DocumentListItem | undefined;
}

function deleteChunksForDocument(documentId: number): void {
  const db = getDb();
  const chunkIds = db
    .prepare(`SELECT id FROM chunks WHERE document_id = ?`)
    .all(documentId) as { id: number }[];
  const delVec = db.prepare(`DELETE FROM chunk_vectors WHERE rowid = ?`);
  for (const { id } of chunkIds) delVec.run(BigInt(id));
  db.prepare(`DELETE FROM chunks WHERE document_id = ?`).run(documentId);
}

/** Returns false when the document doesn't exist or belongs to another bot. */
export function deleteDocument(botId: number, id: number): boolean {
  const db = getDb();
  if (!getDocument(botId, id)) return false;
  const tx = db.transaction((docId: number) => {
    deleteChunksForDocument(docId);
    db.prepare(`DELETE FROM documents WHERE id = ?`).run(docId);
  });
  tx(id);
  return true;
}

/** Re-crawl a URL document in place: old chunks/vectors out, fresh content in. */
export async function reindexUrlDocument(
  botId: number,
  id: number
): Promise<{ chunkCount: number }> {
  const doc = getDocument(botId, id);
  if (!doc) throw new Error("Document not found");
  if (doc.kind !== "url") {
    const err = new Error("Only URL documents can be re-indexed — re-upload the file instead");
    (err as Error & { code?: string }).code = "not_url";
    throw err;
  }
  const parsed = await parseUrlInput(doc.source);
  if (!parsed.text.trim()) throw new Error("Fetched page is empty");
  const chunks = chunkText(parsed.text);

  deleteChunksForDocument(id);
  await insertChunks(botId, id, doc.source, chunks);
  getDb().prepare(`UPDATE documents SET created_at = unixepoch() WHERE id = ?`).run(id);
  return { chunkCount: chunks.length };
}

/** "Start fresh" — wipe the whole knowledge base for one bot. */
export function resetKnowledgeBase(botId: number): { documents: number; chunks: number } {
  return resetBotKnowledge(botId);
}
