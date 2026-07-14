import { env, pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

// Serverless filesystems are read-only outside /tmp; cache model downloads there.
if (process.env.VERCEL) {
  env.cacheDir = "/tmp/transformers-cache";
}

let embedderPromise: Promise<FeatureExtractionPipeline> | null = null;

export const EMBEDDING_DIM = 384;
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", MODEL_NAME) as Promise<FeatureExtractionPipeline>;
  }
  return embedderPromise;
}

export async function embed(text: string): Promise<Float32Array> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data as Float32Array);
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const results: Float32Array[] = [];
  for (const t of texts) {
    results.push(await embed(t));
  }
  return results;
}
