"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function NavHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/70 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="size-8 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary transition-transform duration-200 group-hover:scale-105">
            <ShieldCheck className="size-4" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            SupportKit
          </span>
        </Link>

        {/* Nav links + CTAs */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="hidden sm:inline-flex items-center h-9 px-4 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Admin
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 active:scale-[0.97]"
          >
            Get started
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
