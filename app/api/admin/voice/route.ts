import { checkVoiceHealth, getVoiceCatalog, getVoiceServiceUrl } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only: sidecar status + full voice catalog for the settings UI. */
export async function GET() {
  const url = getVoiceServiceUrl();
  if (!url) {
    return Response.json({ configured: false, health: null, voices: [] });
  }
  const [health, voices] = await Promise.all([checkVoiceHealth(), getVoiceCatalog()]);
  return Response.json({ configured: true, health, voices });
}
