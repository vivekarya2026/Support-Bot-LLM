import { notFound } from "next/navigation";
import { getBotBySlug, listBots } from "@/lib/bots";
import { WorkspaceSidebar } from "@/components/admin/workspace-sidebar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ botSlug: string }>;
}) {
  const { botSlug } = await params;
  const bot = getBotBySlug(botSlug);
  if (!bot) notFound();

  const bots = listBots().map((b) => ({
    slug: b.slug,
    name: b.name,
    primaryColor: b.primary_color,
    newSupportCount: b.new_support_count,
  }));

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <WorkspaceSidebar
        bots={bots}
        current={{ slug: bot.slug, name: bot.name, primaryColor: bot.primary_color }}
      />
      {/* min-w-0 keeps wide tables scrolling inside their own wrapper
          instead of stretching the flex row past the viewport. */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
