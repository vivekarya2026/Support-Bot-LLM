"use client";

import { motion } from "framer-motion";
import { Check, Mic, MicOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoiceOverlayState =
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "blocked"
  | "error";

const STATE_LABEL: Record<VoiceOverlayState, string> = {
  listening: "Listening…",
  transcribing: "Got it…",
  thinking: "Thinking…",
  speaking: "Speaking — tap to interrupt",
  blocked: "Microphone is blocked",
  error: "Something went wrong",
};

/**
 * Hands-free conversation surface: a state orb + live captions layered over
 * the message log. The log stays the source of truth; this is only a lens.
 */
export function VoiceModeOverlay({
  state,
  level,
  caption,
  onOrbTap,
  onExit,
  reduce,
}: {
  state: VoiceOverlayState;
  level: number; // 0..1 mic input level while listening
  caption: string;
  onOrbTap: () => void;
  onExit: () => void;
  reduce: boolean;
}) {
  const active = state === "listening";
  const orbScale = active ? 1 + Math.min(0.25, level * 0.6) : 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.05 : 0.2 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-card/95 backdrop-blur-sm px-6"
      role="region"
      aria-label="Voice conversation mode"
    >
      <button
        type="button"
        onClick={onExit}
        aria-label="Exit voice mode"
        className="absolute top-2 right-2 size-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="size-4" />
      </button>

      {/* State orb — the single tap target (interrupt / force-stop) */}
      <button
        type="button"
        onClick={onOrbTap}
        aria-label={STATE_LABEL[state]}
        className="relative flex items-center justify-center size-28 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* radiating rings while speaking */}
        {state === "speaking" && !reduce && (
          <>
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <span
              className="absolute inset-2 rounded-full bg-primary/15 animate-ping"
              style={{ animationDelay: "300ms" }}
            />
          </>
        )}
        {/* spinner ring while transcribing / thinking */}
        {(state === "transcribing" || state === "thinking") && (
          <span
            className={cn(
              "absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary",
              reduce ? "" : "animate-spin"
            )}
            style={{ animationDuration: "1.2s" }}
            aria-hidden
          />
        )}
        <motion.span
          animate={{ scale: orbScale }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20 }}
          className={cn(
            "relative flex items-center justify-center size-24 rounded-full ring-1",
            state === "blocked" || state === "error"
              ? "bg-destructive/15 ring-destructive/40 text-destructive"
              : "bg-primary/15 ring-primary/40 text-primary"
          )}
        >
          {state === "blocked" ? <MicOff className="size-8" /> : <Mic className="size-8" />}
        </motion.span>
      </button>

      <div className="text-center space-y-1.5 max-w-full">
        <div className="text-sm font-medium text-foreground" role="status">
          {STATE_LABEL[state]}
        </div>
        {caption && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 max-w-[32ch] mx-auto">
            {caption}
          </p>
        )}
        {state === "blocked" && (
          <p className="text-xs text-muted-foreground max-w-[36ch]">
            Allow microphone access in your browser settings, or close voice mode and type instead.
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Composer swap-in while recording: pulse, timer, cancel/stop. */
export function RecordingBar({
  elapsed,
  level,
  onCancel,
  onStop,
  reduce,
}: {
  elapsed: number;
  level: number;
  onCancel: () => void;
  onStop: () => void;
  reduce: boolean;
}) {
  const s = Math.floor(elapsed / 1000);
  const mmss = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className="flex-1 h-11 flex items-center gap-2.5 rounded-md border border-primary/40 bg-primary/10 px-3">
      <motion.span
        animate={reduce ? { opacity: 0.5 + level * 0.5 } : { scale: 1 + Math.min(0.5, level * 1.2) }}
        transition={{ duration: 0.1 }}
        className="size-2.5 rounded-full bg-destructive shrink-0"
        aria-hidden
      />
      <span className="text-sm text-foreground tabular-nums" role="timer" aria-label="Recording time">
        {mmss}
      </span>
      <span className="text-xs text-muted-foreground flex-1 truncate">Listening — tap ✓ when done</span>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel recording"
        className="size-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="size-4" />
      </button>
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop and transcribe"
        className="size-9 rounded-md flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Check className="size-4" />
      </button>
    </div>
  );
}
