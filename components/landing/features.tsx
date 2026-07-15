"use client";

import {
  Brain,
  BookOpen,
  ScrollText,
  Code2,
  Mic,
  BarChart3,
} from "lucide-react";
import { ScrollAnimate } from "./scroll-animate";

const FEATURES = [
  {
    icon: Brain,
    title: "AI chat with RAG citations",
    description:
      "Every answer is grounded in your knowledge base. Citations link back to the original source, so customers trust the response.",
    accent: "from-blue-500/20 to-indigo-500/20",
  },
  {
    icon: BookOpen,
    title: "Feed it anything",
    description:
      "Upload PDFs, DOCX, Markdown files, or crawl entire websites. Documents are chunked, embedded, and indexed with pgvector for instant retrieval.",
    accent: "from-emerald-500/20 to-teal-500/20",
  },
  {
    icon: ScrollText,
    title: "Prompt library",
    description:
      "Keep multiple personas per bot and hot-swap the active prompt. Start from built-in templates for SaaS support, docs assistants, and more.",
    accent: "from-purple-500/20 to-pink-500/20",
  },
  {
    icon: Code2,
    title: "One-line embed",
    description:
      "A single script tag drops the chat launcher on any site. Fully white-label — no SupportKit branding visible to your customers.",
    accent: "from-amber-500/20 to-orange-500/20",
  },
  {
    icon: Mic,
    title: "Voice support",
    description:
      "Speech-to-text and text-to-speech built in. Hands-free mode lets customers speak their questions and hear answers read aloud.",
    accent: "from-cyan-500/20 to-blue-500/20",
  },
  {
    icon: BarChart3,
    title: "Admin panel & analytics",
    description:
      "Manage conversations, track support requests, monitor social mentions, and fine-tune your bot — all from one dashboard.",
    accent: "from-rose-500/20 to-red-500/20",
  },
];

export function Features() {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <ScrollAnimate>
          <div className="text-center mb-20">
            <p className="text-sm font-medium text-primary tracking-wide uppercase">
              Features
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground max-w-2xl mx-auto">
              Everything you need to automate support.
            </h2>
          </div>
        </ScrollAnimate>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <ScrollAnimate
              key={f.title}
              delay={i * 80}
              variant="scale-in"
            >
              <div className="group relative rounded-2xl glass p-6 h-full transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-xl">
                {/* Accent glow on hover */}
                <div
                  aria-hidden
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                <div className="relative">
                  <div className="size-11 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-primary mb-5">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {f.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.description}
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
