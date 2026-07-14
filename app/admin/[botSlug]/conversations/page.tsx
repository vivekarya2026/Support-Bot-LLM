import Link from "next/link";
import { notFound } from "next/navigation";
import { getBotBySlug } from "@/lib/bots";
import { listConversations } from "@/lib/conversations";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  params,
}: {
  params: Promise<{ botSlug: string }>;
}) {
  const { botSlug } = await params;
  const bot = getBotBySlug(botSlug);
  if (!bot) notFound();
  const conversations = listConversations(bot.id);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Every chat with {bot.name} is logged here. Click any row to view the full
        transcript.
      </p>

      <Card className="mt-6 overflow-hidden">
        {conversations.length === 0 ? (
          <div className="p-6 text-sm text-center text-muted-foreground">
            No conversations yet — try the bot at{" "}
            <Link href={`/chat/${bot.slug}`} className="text-primary hover:underline">
              /chat/{bot.slug}
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-stack w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Title</th>
                  <th className="text-left font-medium px-4 py-2.5">Model</th>
                  <th className="text-left font-medium px-4 py-2.5">Msgs</th>
                  <th className="text-left font-medium px-4 py-2.5">Started</th>
                  <th className="text-left font-medium px-4 py-2.5">Updated</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/${bot.slug}/conversations/${c.id}`}
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {c.title ?? (
                          <span className="text-muted-foreground italic">untitled</span>
                        )}
                      </Link>
                    </td>
                    <td data-label="Model" className="px-4 py-2.5">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {c.model ?? "—"}
                      </Badge>
                    </td>
                    <td data-label="Messages" className="px-4 py-2.5 text-muted-foreground">
                      {c.message_count}
                    </td>
                    <td className="stack-hide px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(c.started_at * 1000).toLocaleString()}
                    </td>
                    <td data-label="Updated" className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(c.updated_at * 1000).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
