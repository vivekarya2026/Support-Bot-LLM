"use client";

import { Clock, HelpCircle, DollarSign } from "lucide-react";
import { ScrollAnimate } from "./scroll-animate";

const PROBLEMS = [
  {
    icon: Clock,
    stat: "67%",
    label: "of customers leave",
    body: "Slow response times drive customers to competitors before you can even reply.",
  },
  {
    icon: HelpCircle,
    stat: "40%",
    label: "answers are wrong",
    body: "Without a single source of truth, agents give inconsistent, outdated answers.",
  },
  {
    icon: DollarSign,
    stat: "$15k+",
    label: "per support agent",
    body: "Scaling human support is expensive — and training new agents takes months.",
  },
];

export function ProblemCards() {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <ScrollAnimate>
          <p className="text-sm font-medium text-primary tracking-wide uppercase">
            The Problem
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground max-w-lg">
            Customer support is broken.
          </h2>
        </ScrollAnimate>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PROBLEMS.map((p, i) => (
            <ScrollAnimate key={i} delay={i * 120} variant="fade-up">
              <div className="group relative rounded-2xl glass p-6 h-full transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-lg">
                <div className="size-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-primary mb-5">
                  <p.icon className="size-5" />
                </div>
                <div className="text-3xl font-bold text-foreground tracking-tight">
                  {p.stat}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {p.label}
                </div>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  {p.body}
                </p>
              </div>
            </ScrollAnimate>
          ))}
        </div>
      </div>
    </section>
  );
}
