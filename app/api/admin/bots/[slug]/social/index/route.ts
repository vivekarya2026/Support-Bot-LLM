import { NextRequest } from "next/server";
import { getBotBySlug } from "@/lib/bots";
import { indexDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  url?: string;
  title?: string;
  content?: string;
};

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = getBotBySlug(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  if (!url || !content) {
    return Response.json(
      { error: "url and content are required" },
      { status: 400 }
    );
  }

  try {
    // Prepend the title so the chunk text gives the LLM useful context.
    const text = title ? `# ${title}\n\n${content}` : content;
    const result = await indexDocument(bot.id, { kind: "url", source: url, text });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
