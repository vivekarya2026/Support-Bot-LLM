import Link from "next/link";
import { redirect } from "next/navigation";
import { listBotsAsync } from "@/lib/bots";
import { getRedactedSettingsAsync } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  BookOpen,
  Bot,
  LifeBuoy,
  MessagesSquare,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorkspaceIndexPage() {
  const bots = await listBotsAsync();
  if (bots.length === 0) redirect("/onboarding");
  const settings = await getRedactedSettingsAsync();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
            <ShieldCheck className="size-4.5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">SupportKit</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Workspaces
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 min-h-11 px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="size-4" />
            Global settings
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-4" />
            New workspace
          </Link>
        </div>
      </header>

      {!settings.openrouter_api_key_set && (
        <div className="mt-6 text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg px-4 py-3">
          No LLM API key configured yet — bots can&rsquo;t answer until you add one in{" "}
          <Link href="/admin/settings" className="underline hover:text-foreground">
            global settings
          </Link>
          .
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {bots.map((bot) => (
          <Link key={bot.id} href={`/admin/${bot.slug}`} className="group">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:border-primary/30">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="size-10 rounded-xl ring-1 flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `hsl(${bot.primary_color} / 0.15)`,
                        color: `hsl(${bot.primary_color})`,
                        borderColor: `hsl(${bot.primary_color} / 0.3)`,
                      }}
                    >
                      <Bot className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {bot.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        /{bot.slug}
                      </div>
                    </div>
                  </div>
                  {bot.new_support_count > 0 && (
                    <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive shrink-0">
                      {bot.new_support_count} new
                    </Badge>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="size-3.5" />
                    {bot.doc_count} docs
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessagesSquare className="size-3.5" />
                    {bot.conversation_count} convos
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <LifeBuoy className="size-3.5" />
                    {bot.new_support_count} open
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ArrowUpRight className="size-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <footer className="mt-12 text-xs text-muted-foreground">
        SupportKit — white-label support chatbots, by Vivek Arya.
      </footer>
    </div>
  );
}
