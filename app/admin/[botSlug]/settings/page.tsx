import { notFound } from "next/navigation";
import { getBotBySlugAsync, serializeBot } from "@/lib/bots";
import { BotSettingsForm } from "./settings-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BotSettingsPage({
  params,
}: {
  params: Promise<{ botSlug: string }>;
}) {
  const { botSlug } = await params;
  const bot = await getBotBySlugAsync(botSlug);
  if (!bot) notFound();
  return <BotSettingsForm initial={serializeBot(bot)} />;
}
