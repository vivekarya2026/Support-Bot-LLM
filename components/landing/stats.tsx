"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollAnimate } from "./scroll-animate";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const duration = 1800;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [started, target]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

const STATS = [
  { value: 10000, suffix: "+", label: "Conversations handled" },
  { value: 500, suffix: "+", label: "Documents indexed" },
  { value: 50, suffix: "+", label: "Bots deployed" },
];

export function Stats() {
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <ScrollAnimate variant="scale-in">
          <div className="rounded-2xl glass-strong p-10 sm:p-14">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 text-center">
              {STATS.map((s, i) => (
                <div key={i}>
                  <div className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimate>
      </div>
    </section>
  );
}
