import { notFound } from "next/navigation";
import { getBotByPublicKeyAsync, toPublicConfig } from "@/lib/bots";
import { ChatWidget } from "@/components/widget/chat-widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Iframe surface for the embed snippet — the widget fills the whole frame. */
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ botKey: string }>;
}) {
  const { botKey } = await params;
  const bot = await getBotByPublicKeyAsync(botKey);
  if (!bot) notFound();
  const config = toPublicConfig(bot);

  return (
    <div
      className="h-dvh w-full"
      style={{ "--primary": config.primaryColor, "--ring": config.primaryColor } as React.CSSProperties}
    >
      <ChatWidget config={config} mode="embedded" />
    </div>
  );
}
