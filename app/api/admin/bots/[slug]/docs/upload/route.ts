import { NextRequest } from "next/server";
import { getBotBySlugAsync } from "@/lib/bots";
import { indexDocument, parseFileBuffer, parseUrlInput } from "@/lib/documents";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return Response.json({ error: "file is required" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseFileBuffer(file.name, buffer);
      const { documentId, chunkCount } = await indexDocument(bot.id, parsed);
      return Response.json({ ok: true, documentId, chunkCount, kind: parsed.kind, source: parsed.source });
    }

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { url?: string };
      if (!body.url) return Response.json({ error: "url is required" }, { status: 400 });
      const parsed = await parseUrlInput(body.url);
      const { documentId, chunkCount } = await indexDocument(bot.id, parsed);
      return Response.json({ ok: true, documentId, chunkCount, kind: parsed.kind, source: parsed.source });
    }

    return Response.json({ error: "unsupported content type" }, { status: 415 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
