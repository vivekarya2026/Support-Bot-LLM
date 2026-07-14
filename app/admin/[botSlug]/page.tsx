import { notFound } from "next/navigation";
import Link from "next/link";
import { getBotBySlugAsync } from "@/lib/bots";
import { listConversations, listSupportRequests } from "@/lib/conversations";
import { listDocuments } from "@/lib/documents";
import { getRedactedSettingsAsync } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, BookOpen, KeyRound, LifeBuoy, MessagesSquare } from "lucide-react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BotDashboard({
  params,
}: {
  params: Promise<{ botSlug: string }>;
}) {
  const { botSlug } = await params;
  const bot = await getBotBySlugAsync(botSlug);
  if (!bot) notFound();

  const settings = await getRedactedSettingsAsync();
  const docs = await listDocuments(bot.id);
  const conversations = await listConversations(bot.id, 10);
  const support = await listSupportRequests(bot.id);
  const newSupport = support.filter((s) => s.status === "new").length;
  const totalChunks = docs.reduce((acc, d) => acc + d.chunk_count, 0);
  const base = `/admin/${bot.slug}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{bot.name}</h1>
      <p className="text-sm text-muted-foreground mt-1">
        What visitors are asking, what the bot knows, and what needs a human.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <Stat
          icon={<KeyRound className="size-4" />}
          label="API key"
          value={settings.openrouter_api_key_set ? "Configured" : "Missing"}
          tone={settings.openrouter_api_key_set ? "ok" : "warn"}
          href="/admin/settings"
        />
        <Stat
          icon={<BookOpen className="size-4" />}
          label="Docs / chunks"
          value={`${docs.length} / ${totalChunks}`}
          href={`${base}/docs`}
        />
        <Stat
          icon={<MessagesSquare className="size-4" />}
          label="Conversations"
          value={String(conversations.length)}
          href={`${base}/conversations`}
        />
        <Stat
          icon={<LifeBuoy className="size-4" />}
          label="New support"
          value={String(newSupport)}
          tone={newSupport > 0 ? "warn" : "ok"}
          href={`${base}/support`}
        />
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Recent conversations</h2>
          <Link
            href={`${base}/conversations`}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            View all <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <Card className="mt-3 overflow-hidden">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No conversations yet. Share{" "}
              <Link href={`/chat/${bot.slug}`} className="text-primary hover:underline">
                the chat page
              </Link>{" "}
              or embed the widget — real questions will land here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-stack w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Title</th>
                    <th className="text-left font-medium px-4 py-2.5">Model</th>
                    <th className="text-left font-medium px-4 py-2.5">Msgs</th>
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
                          href={`${base}/conversations/${c.id}`}
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
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn";
  href?: string;
}) {
  const body = (
    <Card className="hover:border-border transition-all hover:translate-y-[-1px] cursor-pointer h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </div>
          <div
            className={
              "size-7 rounded-md flex items-center justify-center ring-1 " +
              (tone === "warn"
                ? "bg-warning/10 ring-warning/30 text-warning"
                : tone === "ok"
                  ? "bg-success/10 ring-success/30 text-success"
                  : "bg-muted ring-border text-muted-foreground")
            }
          >
            {icon}
          </div>
        </div>
        <div
          className={
            "mt-2 text-xl font-semibold " +
            (tone === "warn"
              ? "text-warning"
              : tone === "ok"
                ? "text-success"
                : "text-foreground")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
