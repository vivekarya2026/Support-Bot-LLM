import path from "node:path";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import mammoth from "mammoth";
import { getSupabase, nowEpoch } from "./supabase";
import { embed } from "./embeddings";

export type DocumentKind = "md" | "txt" | "pdf" | "docx" | "url";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

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
  const supabase = getSupabase();
  for (let i = 0; i < chunks.length; i++) {
    const vec = await embed(chunks[i]);
    const vecStr = `[${vec.join(",")}]`;
    await supabase.from("chunks").insert({
      document_id: documentId,
      bot_id: botId,
      source,
      chunk_index: i,
      content: chunks[i],
      embedding: vecStr,
    });
  }
}

export async function indexDocument(
  botId: number,
  doc: ParsedDocument
): Promise<{ documentId: number; chunkCount: number }> {
  if (!doc.text || doc.text.trim().length === 0) {
    throw new Error("Parsed document is empty");
  }
  const supabase = getSupabase();
  const chunks = chunkText(doc.text);

  const { data, error } = await supabase
    .from("documents")
    .insert({ bot_id: botId, source: doc.source, kind: doc.kind, created_at: nowEpoch() })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to insert document: ${error?.message}`);
  const documentId = data.id;

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

export async function listDocuments(botId: number): Promise<DocumentListItem[]> {
  const supabase = getSupabase();
  const { data: docs } = await supabase
    .from("documents")
    .select("id, source, kind, created_at")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false });

  if (!docs) return [];

  const results: DocumentListItem[] = [];
  for (const d of docs) {
    const { count } = await supabase
      .from("chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", d.id);
    results.push({ ...d, kind: d.kind as DocumentKind, chunk_count: count ?? 0 });
  }
  return results;
}

export async function getDocument(
  botId: number,
  id: number
): Promise<DocumentListItem | undefined> {
  const supabase = getSupabase();
  const { data: d } = await supabase
    .from("documents")
    .select("id, source, kind, created_at")
    .eq("id", id)
    .eq("bot_id", botId)
    .single();
  if (!d) return undefined;

  const { count } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true })
    .eq("document_id", d.id);
  return { ...d, kind: d.kind as DocumentKind, chunk_count: count ?? 0 };
}

async function deleteChunksForDocument(documentId: number): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("chunks").delete().eq("document_id", documentId);
}

export async function deleteDocument(botId: number, id: number): Promise<boolean> {
  const doc = await getDocument(botId, id);
  if (!doc) return false;
  const supabase = getSupabase();
  await deleteChunksForDocument(id);
  await supabase.from("documents").delete().eq("id", id);
  return true;
}

export async function reindexUrlDocument(
  botId: number,
  id: number
): Promise<{ chunkCount: number }> {
  const doc = await getDocument(botId, id);
  if (!doc) throw new Error("Document not found");
  if (doc.kind !== "url") {
    const err = new Error("Only URL documents can be re-indexed — re-upload the file instead");
    (err as Error & { code?: string }).code = "not_url";
    throw err;
  }
  const parsed = await parseUrlInput(doc.source);
  if (!parsed.text.trim()) throw new Error("Fetched page is empty");
  const chunks = chunkText(parsed.text);

  await deleteChunksForDocument(id);
  await insertChunks(botId, id, doc.source, chunks);

  const supabase = getSupabase();
  await supabase.from("documents").update({ created_at: nowEpoch() }).eq("id", id);
  return { chunkCount: chunks.length };
}

export async function resetKnowledgeBase(
  botId: number
): Promise<{ documents: number; chunks: number }> {
  const supabase = getSupabase();
  const { count: chunks } = await supabase
    .from("chunks")
    .delete({ count: "exact" })
    .eq("bot_id", botId);
  const { count: documents } = await supabase
    .from("documents")
    .delete({ count: "exact" })
    .eq("bot_id", botId);
  return { documents: documents ?? 0, chunks: chunks ?? 0 };
}
