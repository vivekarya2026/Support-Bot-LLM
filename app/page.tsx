import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Code2,
  MessagesSquare,
  Palette,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { listBotsAsync, toPublicConfig } from "@/lib/bots";
import { ChatWidget } from "@/components/widget/chat-widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const bots = await listBotsAsync();
  if (bots.length === 0) redirect("/onboarding");
  const demoBot = bots[0];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">SupportKit</div>
              <div className="text-xs text-muted-foreground">by Vivek Arya</div>
            </div>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Open admin
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 pt-16 pb-10">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground max-w-2xl">
            White-label support chatbots, each with its own brain.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-xl leading-relaxed">
            Spin up a bot per product, feed it your docs, give it a voice with swappable
            system prompts, and drop it on any site with one script tag. Every answer
            cites its sources.
          </p>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-1.5 min-h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="size-4" />
              Create a bot
            </Link>
            <span className="text-xs text-muted-foreground">
              Try the live demo — bottom right corner.
            </span>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FeatureCard
            icon={<BookOpen className="size-4" />}
            title="Feed it anything"
            body="PDF, DOCX, Markdown, or crawled URLs — indexed locally, cited in every answer. Wipe a bot's knowledge and start fresh anytime."
          />
          <FeatureCard
            icon={<ScrollText className="size-4" />}
            title="Prompt library"
            body="Keep several personas per bot and switch the active one instantly. Templates for support, docs, helpdesk, and more."
          />
          <FeatureCard
            icon={<Code2 className="size-4" />}
            title="Embed anywhere"
            body="A share page per bot plus a one-line script tag that drops the launcher on any site. No SupportKit branding inside the widget."
          />
        </section>

        <section className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium text-foreground">Your workspaces</h2>
            <Link href="/admin" className="text-xs text-primary hover:underline">
              Manage all
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bots.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
              >
                <div
                  className="size-9 rounded-lg ring-1 flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `hsl(${b.primary_color} / 0.15)`,
                    color: `hsl(${b.primary_color})`,
                  }}
                >
                  <Bot className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.doc_count} docs · {b.conversation_count} convos
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/chat/${b.slug}`}
                    className="min-h-11 px-2.5 inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Open share page"
                  >
                    <MessagesSquare className="size-4" />
                  </Link>
                  <Link
                    href={`/admin/${b.slug}`}
                    className="min-h-11 px-2.5 inline-flex items-center text-xs text-primary hover:underline"
                  >
                    Admin
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>SupportKit — white-label support chatbots.</span>
          <span className="inline-flex items-center gap-1.5">
            <Palette className="size-3.5" />
            Built by Vivek Arya
          </span>
        </div>
      </footer>

      {/* Live demo: the first workspace's bot, exactly as visitors would see it */}
      <ChatWidget config={toPublicConfig(demoBot)} mode="floating" />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="size-8 rounded-md bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="mt-3 text-sm font-semibold text-foreground">{title}</div>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
