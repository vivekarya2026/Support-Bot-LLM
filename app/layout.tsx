import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "SupportKit",
  description:
    "White-label support chatbots with their own knowledge base, prompts, and branding — by Vivek Arya.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Cover lets fixed elements extend under notches; safe-area insets handle the rest.
  viewportFit: "cover",
  themeColor: "#0f1115", // hsl(222 16% 7%) == --background
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
