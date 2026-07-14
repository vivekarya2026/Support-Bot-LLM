import Link from "next/link";
import { notFound } from "next/navigation";
import { getBotBySlug } from "@/lib/bots";
import { getConversation } from "@/lib/conversations";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ botSlug: string; id: string }>;
}) {
  const { botSlug, id } = await params;
  const bot = getBotBySlug(botSlug);
  if (!bot) notFound();
  const { conversation, messages } = getConversation(id);
  if (!conversation || conversation.bot_id !== bot.id) notFound();

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/${bot.slug}/conversations`}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-3.5" />
        All conversations
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mt-3">
        {conversation.title ?? (
          <span className="text-muted-foreground italic">Untitled conversation</span>
        )}
      </h1>
      <div className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          Model:{" "}
          <Badge variant="secondary" className="font-mono text-xs">
            {conversation.model ?? "—"}
          </Badge>
        </span>
        <span>Started: {new Date(conversation.started_at * 1000).toLocaleString()}</span>
        <span>Messages: {messages.length}</span>
      </div>

      <div className="mt-8 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">
              {m.role} · {new Date(m.created_at * 1000).toLocaleTimeString()}
            </div>
            <div
              className={cn(
                "inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-md shadow-sm shadow-primary/20"
                  : "bg-secondary/70 text-foreground border border-border rounded-tl-md"
              )}
            >
              {m.content}
            </div>
            {m.role === "assistant" && m.citations && (
              <details className="mt-1.5 text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground transition-colors">
                  Sources
                </summary>
                <pre className="mt-1.5 text-xs bg-muted/40 border border-border rounded-md p-2 overflow-auto">
                  {prettifyCitations(m.citations)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function prettifyCitations(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
