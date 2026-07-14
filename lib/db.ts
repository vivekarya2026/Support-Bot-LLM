import { getSupabase, generatePublicKey } from "./supabase";

export { generatePublicKey };

/** Wipe one bot's knowledge base: chunks (with embeddings) and documents. */
export async function resetBotKnowledge(
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
