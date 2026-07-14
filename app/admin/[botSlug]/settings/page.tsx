import { notFound } from "next/navigation";
import { getBotBySlug, serializeBot } from "@/lib/bots";
import { BotSettingsForm } from "./settings-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BotSettingsPage({
  params,
}: {
  params: Promise<{ botSlug: string }>;
}) {
  const { botSlug } = await params;
  const bot = getBotBySlug(botSlug);
  if (!bot) notFound();
  return <BotSettingsForm initial={serializeBot(bot)} />;
}
