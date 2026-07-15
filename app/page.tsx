import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Palette } from "lucide-react";
import { listBotsAsync, toPublicConfig } from "@/lib/bots";
import { Hero } from "@/components/landing/hero";
import { ProblemCards } from "@/components/landing/problem-cards";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { Stats } from "@/components/landing/stats";
import { CTA } from "@/components/landing/cta";
import { NavHeader } from "@/components/landing/nav-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const bots = await listBotsAsync();
  if (bots.length === 0) redirect("/onboarding");
  const demoBot = bots[0];
  const botConfig = toPublicConfig(demoBot);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <NavHeader />

      <main className="flex-1">
        <Hero botConfig={botConfig} />
        <ProblemCards />
        <HowItWorks />
        <Features />
        <Stats />
        <CTA />
      </main>

      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
              <ShieldCheck className="size-3.5" />
            </div>
            <span>SupportKit</span>
          </div>
          <span className="inline-flex items-center gap-1.5">
            <Palette className="size-3.5" />
            Built by Vivek Arya
          </span>
        </div>
      </footer>
    </div>
  );
}
