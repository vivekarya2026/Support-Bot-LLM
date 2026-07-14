import { notFound } from "next/navigation";
import { getBotBySlugAsync } from "@/lib/bots";
import { SocialListening } from "./social-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SocialPage({
  params,
}: {
  params: Promise<{ botSlug: string }>;
}) {
  const { botSlug } = await params;
  const bot = await getBotBySlugAsync(botSlug);
  if (!bot) notFound();
  return <SocialListening botSlug={bot.slug} botName={bot.name} />;
}
