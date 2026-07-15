import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ChatWidget } from "@/components/widget/chat-widget";
import type { WidgetConfig } from "@/components/widget/types";

export function Hero({ botConfig }: { botConfig: WidgetConfig }) {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background gradient orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-[300px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse, hsl(217 91% 60% / 0.12) 0%, transparent 70%)",
            animation: "orbPulse 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-[20%] -left-[200px] w-[500px] h-[500px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(260 80% 60% / 0.06) 0%, transparent 70%)",
            animation: "orbPulse 12s ease-in-out infinite 2s",
          }}
        />
        <div
          className="absolute bottom-[10%] -right-[150px] w-[400px] h-[400px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(200 90% 50% / 0.05) 0%, transparent 70%)",
            animation: "orbPulse 10s ease-in-out infinite 4s",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center py-20 lg:py-0">
        {/* Left: Copy + CTA */}
        <div className="[animation:fadeInUp_800ms_ease-out_100ms_both]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-muted-foreground mb-6">
            <Sparkles className="size-3 text-primary" />
            AI-powered support in minutes
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-tight leading-[1.1] text-foreground">
            Your customers deserve{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-blue-300">
              instant, intelligent
            </span>{" "}
            answers.
          </h1>

          <p className="mt-5 text-lg text-muted-foreground max-w-lg leading-relaxed">
            Stop losing customers to slow support queues. Deploy an AI chatbot
            trained on your docs that answers questions instantly — with
            citations.
          </p>

          <div className="mt-8 flex items-center gap-4 flex-wrap">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold glow-primary transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started free
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-full glass text-sm font-medium text-foreground hover:bg-white/10 transition-colors duration-200"
            >
              Open admin
            </Link>
          </div>
        </div>

        {/* Right: Live demo in glass frame */}
        <div className="[animation:fadeInUp_800ms_ease-out_400ms_both] relative">
          <div
            className="relative rounded-2xl glass-strong p-1 shadow-2xl"
            style={{ animation: "float 6s ease-in-out infinite" }}
          >
            {/* Browser chrome mockup */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
              <div className="size-2.5 rounded-full bg-white/15" />
              <div className="size-2.5 rounded-full bg-white/15" />
              <div className="size-2.5 rounded-full bg-white/15" />
              <div className="ml-3 flex-1 h-5 rounded-md bg-white/5 max-w-[200px]" />
            </div>

            {/* Chat widget inline */}
            <div className="h-[420px] sm:h-[480px] overflow-hidden rounded-b-xl">
              <ChatWidget config={botConfig} mode="embedded" />
            </div>
          </div>

          {/* Decorative glow behind frame */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-2xl blur-3xl opacity-30"
            style={{
              background:
                "radial-gradient(ellipse at center, hsl(217 91% 60% / 0.3), transparent 70%)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
