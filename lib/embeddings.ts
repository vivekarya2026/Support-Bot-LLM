import { getSupabase } from "./supabase";

export const EMBEDDING_DIM = 384;

/**
 * Generate an embedding using Supabase's Edge Function or a direct
 * OpenAI-compatible endpoint. Falls back to a Supabase RPC that calls
 * the pgvector-compatible ai.embed() if available.
 */
export async function embed(text: string): Promise<number[]> {
  const supabase = getSupabase();

  // Use Supabase's built-in embedding via an RPC function
  const { data, error } = await supabase.rpc("embed_text", { input_text: text });

  if (!error && data) {
    return data as number[];
  }

  // Fallback: call OpenAI-compatible embedding endpoint
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No embedding source available. Either configure Supabase ai.embed() or set OPENROUTER_API_KEY."
    );
  }

  const baseUrl =
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
      dimensions: EMBEDDING_DIM,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.data[0].embedding as number[];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const t of texts) {
    results.push(await embed(t));
  }
  return results;
}
