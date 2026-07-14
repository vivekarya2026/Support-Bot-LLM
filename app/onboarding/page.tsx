import type { Metadata } from "next";
import { getRedactedSettingsAsync } from "@/lib/settings";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Set up your bot — SupportKit" };

export default async function OnboardingPage() {
  const settings = await getRedactedSettingsAsync();
  return (
    <OnboardingWizard
      providerConfigured={settings.openrouter_api_key_set}
      currentBaseUrl={settings.openrouter_base_url}
      currentModel={settings.default_model}
    />
  );
}
