import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { getBotBySlug, toPublicConfig } from "@/lib/bots";
import { ChatWidget } from "@/components/widget/chat-widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ botSlug: string }>;
}): Promise<Metadata> {
  const { botSlug } = await params;
  const bot = getBotBySlug(botSlug);
  return { title: bot ? `${bot.name} — Chat` : "Chat" };
}

export default async function ShareChatPage({
  params,
}: {
  params: Promise<{ botSlug: string }>;
}) {
  const { botSlug } = await params;
  const bot = getBotBySlug(botSlug);
  if (!bot) notFound();
  const config = toPublicConfig(bot);

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ "--primary": config.primaryColor, "--ring": config.primaryColor } as React.CSSProperties}
    >
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{config.name}</div>
            <div className="text-xs text-muted-foreground">Ask anything — answers cite their sources.</div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 min-h-0">
        <div className="h-[calc(100dvh-11rem)] rounded-2xl overflow-hidden border border-border shadow-2xl shadow-black/40">
          <ChatWidget config={config} mode="embedded" />
        </div>
      </main>

      <footer className="pb-4">
        <div className="max-w-2xl mx-auto px-4 text-center text-xs text-muted-foreground">
          Powered by SupportKit · by Vivek Arya
        </div>
      </footer>
    </div>
  );
}
