import { getDb } from "./db";
import { embed } from "./embeddings";

export type RetrievedChunk = {
  id: number;
  source: string;
  chunkIndex: number;
  content: string;
  distance: number;
};

/** KNN over the bot's vector partition only — cross-bot leakage is impossible here. */
export async function retrieve(botId: number, query: string, k = 4): Promise<RetrievedChunk[]> {
  const db = getDb();
  const queryEmbedding = await embed(query);

  const rows = db
    .prepare(
      `
      SELECT
        c.id        AS id,
        c.source    AS source,
        c.chunk_index AS chunkIndex,
        c.content   AS content,
        v.distance  AS distance
      FROM chunk_vectors v
      JOIN chunks c ON c.id = v.rowid
      WHERE v.embedding MATCH vec_f32(?)
        AND v.bot_id = ?
        AND k = ?
      ORDER BY v.distance
      `
    )
    .all(JSON.stringify(Array.from(queryEmbedding)), BigInt(botId), k) as RetrievedChunk[];

  return rows;
}

export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] Source: ${c.source} (chunk ${c.chunkIndex})\n${c.content}`
    )
    .join("\n\n---\n\n");
}
