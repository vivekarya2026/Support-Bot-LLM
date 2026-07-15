import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollAnimate } from "./scroll-animate";

export function CTA() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Ambient orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse, hsl(217 91% 60% / 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        <ScrollAnimate>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-tight">
            Ready to transform your customer support?
          </h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Deploy an AI chatbot that knows your product inside out — in under 5 minutes.
          </p>
        </ScrollAnimate>

        <ScrollAnimate delay={150}>
          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold glow-primary transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started free
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-full glass text-sm font-medium text-foreground hover:bg-white/10 transition-colors duration-200"
            >
              View admin panel
            </Link>
          </div>
        </ScrollAnimate>
      </div>
    </section>
  );
}
