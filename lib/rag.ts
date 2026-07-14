import { getSupabase } from "./supabase";
import { embed } from "./embeddings";

export type RetrievedChunk = {
  id: number;
  source: string;
  chunk_index: number;
  content: string;
  distance: number;
};

export async function retrieve(botId: number, query: string, k = 4): Promise<RetrievedChunk[]> {
  const supabase = getSupabase();
  const queryEmbedding = await embed(query);

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: `[${queryEmbedding.join(",")}]`,
    match_bot_id: botId,
    match_count: k,
  });

  if (error) {
    console.error("RAG retrieve error:", error.message);
    return [];
  }

  return (data ?? []) as RetrievedChunk[];
}

export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] Source: ${c.source} (chunk ${c.chunk_index})\n${c.content}`
    )
    .join("\n\n---\n\n");
}
