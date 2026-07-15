"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type AnimationVariant = "fade-up" | "fade-left" | "fade-right" | "scale-in";

interface ScrollAnimateProps {
  children: React.ReactNode;
  variant?: AnimationVariant;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

const VARIANT_CLASS: Record<AnimationVariant, string> = {
  "fade-up": "[animation:fadeInUp_var(--sa-duration)_ease-out_var(--sa-delay)_both]",
  "fade-left": "[animation:fadeInLeft_var(--sa-duration)_ease-out_var(--sa-delay)_both]",
  "fade-right": "[animation:fadeInRight_var(--sa-duration)_ease-out_var(--sa-delay)_both]",
  "scale-in": "[animation:scaleIn_var(--sa-duration)_ease-out_var(--sa-delay)_both]",
};

export function ScrollAnimate({
  children,
  variant = "fade-up",
  delay = 0,
  duration = 800,
  className,
  once = true,
}: ScrollAnimateProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      className={cn(
        visible ? VARIANT_CLASS[variant] : "opacity-0",
        className
      )}
      style={
        {
          "--sa-delay": `${delay}ms`,
          "--sa-duration": `${duration}ms`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
