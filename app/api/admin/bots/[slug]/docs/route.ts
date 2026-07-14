import { NextRequest } from "next/server";
import { getBotBySlugAsync } from "@/lib/bots";
import { deleteDocument, listDocuments } from "@/lib/documents";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  return Response.json({ documents: await listDocuments(bot.id) });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const bot = await getBotBySlugAsync(slug);
  if (!bot) return Response.json({ error: "bot not found" }, { status: 404 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  if (!(await deleteDocument(bot.id, id))) {
    return Response.json({ error: "document not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
