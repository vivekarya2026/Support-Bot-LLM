import { NextRequest } from "next/server";
import { getBotBySlug } from "@/lib/bots";
import { reindexUrlDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ slug: string; docId: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { slug, docId } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  const id = Number(docId);
  if (!Number.isFinite(id)) return Response.json({ error: "invalid id" }, { status: 400 });

  try {
    const { chunkCount } = await reindexUrlDocument(bot.id, id);
    return Response.json({ ok: true, chunkCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as Error & { code?: string }).code === "not_url" ? 409 : 500;
    return Response.json({ error: message }, { status: message === "Document not found" ? 404 : status });
  }
}
