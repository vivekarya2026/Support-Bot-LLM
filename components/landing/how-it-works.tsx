"use client";

import { Upload, Settings, Code2 } from "lucide-react";
import { ScrollAnimate } from "./scroll-animate";

const STEPS = [
  {
    num: "01",
    icon: Upload,
    title: "Upload your docs",
    description:
      "Feed it PDFs, DOCX files, Markdown, or crawl your website. SupportKit chunks, embeds, and indexes everything automatically.",
  },
  {
    num: "02",
    icon: Settings,
    title: "Configure your bot",
    description:
      "Give it a name, branding, system prompt, and choose an LLM. Swap prompts on the fly with the built-in prompt library.",
  },
  {
    num: "03",
    icon: Code2,
    title: "Embed anywhere",
    description:
      "Drop a single script tag on any website. Your bot launches instantly — no SupportKit branding, fully white-label.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-32 px-6">
      {/* Decorative vertical line */}
      <div
        aria-hidden
        className="hidden md:block absolute left-1/2 top-48 bottom-48 w-px bg-gradient-to-b from-transparent via-border to-transparent"
      />

      <div className="max-w-4xl mx-auto">
        <ScrollAnimate>
          <div className="text-center mb-20">
            <p className="text-sm font-medium text-primary tracking-wide uppercase">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Three steps to smarter support.
            </h2>
          </div>
        </ScrollAnimate>

        <div className="space-y-16 md:space-y-24">
          {STEPS.map((step, i) => (
            <ScrollAnimate
              key={step.num}
              delay={i * 100}
              variant={i % 2 === 0 ? "fade-left" : "fade-right"}
            >
              <div
                className={`flex flex-col md:flex-row items-start gap-6 md:gap-10 ${
                  i % 2 !== 0 ? "md:flex-row-reverse md:text-right" : ""
                }`}
              >
                {/* Numbered badge */}
                <div className="shrink-0 size-14 rounded-2xl glass-strong flex items-center justify-center relative">
                  <span className="text-sm font-bold text-primary">
                    {step.num}
                  </span>
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      boxShadow: "0 0 20px hsl(217 91% 60% / 0.2)",
                    }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 max-w-md">
                  <div className="flex items-center gap-3 mb-2">
                    <step.icon className="size-5 text-primary" />
                    <h3 className="text-xl font-semibold text-foreground">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </ScrollAnimate>
          ))}
        </div>
      </div>
    </section>
  );
}
