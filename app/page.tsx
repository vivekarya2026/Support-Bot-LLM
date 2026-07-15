import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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

      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          {/* Open Source Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-4 px-6 rounded-xl glass text-center sm:text-left">
            <div className="flex items-center gap-2 text-sm text-foreground font-medium">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              Open source — clone and deploy your own
            </div>
            <code className="text-xs bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-muted-foreground select-all">
              git clone https://github.com/vivekarya2026/Support-Bot-LLM.git
            </code>
          </div>

          {/* Footer links */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-md bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
                <ShieldCheck className="size-3.5" />
              </div>
              <span>SupportKit</span>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="https://github.com/vivekarya2026"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/arya-vivek/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
              <span>Built by Vivek Arya</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
