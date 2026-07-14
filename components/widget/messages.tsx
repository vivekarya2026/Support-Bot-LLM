"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, RotateCcw, Sparkles, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Citation, Message, WidgetConfig } from "./types";

export type SpeakState = "idle" | "loading" | "playing";

export function Bubble({
  m,
  waitingFirstToken,
  onSpeak,
  speakState = "idle",
  speakUnavailable = false,
}: {
  m: Message;
  waitingFirstToken: boolean;
  /** When provided (and the reply is settled), a speaker button renders. */
  onSpeak?: () => void;
  speakState?: SpeakState;
  /** Reply language has no TTS voice — show a quiet notice instead of a button. */
  speakUnavailable?: boolean;
}) {
  const isUser = m.role === "user";
  const showTyping = !isUser && waitingFirstToken && !m.content;
  const showCaret = !isUser && m.streaming && m.content.length > 0;
  const showSpeaker = !isUser && !m.streaming && !!m.content && !!onSpeak && !speakUnavailable;

  return (
    <div
      className={cn(
        "inline-block max-w-[88%] rounded-2xl px-3.5 py-2 whitespace-pre-wrap text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-md shadow-sm shadow-primary/20"
          : "bg-secondary/70 text-foreground border border-border rounded-tl-md"
      )}
    >
      {showTyping ? (
        <span className="typing-dots inline-flex items-end gap-1 py-1" aria-label="Typing">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <span className={showCaret ? "streaming-caret" : undefined}>{m.content}</span>
      )}
      {showSpeaker && (
        <button
          type="button"
          onClick={onSpeak}
          aria-label={speakState === "playing" ? "Stop audio" : "Play reply aloud"}
          className="ml-2 -my-2 inline-flex size-11 align-middle items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {speakState === "loading" ? (
            <span
              className="size-3.5 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin"
              aria-hidden
            />
          ) : speakState === "playing" ? (
            <Square className="size-3.5 fill-current" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </button>
      )}
      {!isUser && speakUnavailable && (
        <div className="mt-1 text-xs text-muted-foreground/70">
          Audio isn&apos;t available in this language
        </div>
      )}
    </div>
  );
}

export function ErrorBubble({ m, onRetry }: { m: Message; onRetry: () => void }) {
  return (
    <div className="inline-block max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed bg-destructive/10 border border-destructive/30 text-foreground">
      <div className="text-xs text-destructive break-words">{m.content}</div>
      <button
        onClick={onRetry}
        className="mt-1.5 inline-flex items-center gap-1.5 min-h-11 -my-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors"
      >
        <RotateCcw className="size-3.5" />
        Retry
      </button>
    </div>
  );
}

export function CitationDisclosure({
  citations,
  reduce,
}: {
  citations: Citation[];
  reduce: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5 text-xs text-muted-foreground">
      <button
        onClick={() => setOpen((x) => !x)}
        className="inline-flex items-center gap-1 min-h-11 -my-3 hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          className="inline-block"
        >
          ▸
        </motion.span>
        {citations.length} source{citations.length === 1 ? "" : "s"}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="overflow-hidden mt-1 space-y-1"
          >
            {citations.map((c) => (
              <li key={c.n} className="border-l-2 border-border pl-2 py-0.5">
                <span className="font-mono text-muted-foreground/80">[{c.n}]</span> {c.source} —{" "}
                {c.preview.slice(0, 90)}…
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FollowupChips({
  followups,
  reduce,
  onPick,
}: {
  followups: string[];
  reduce: boolean;
  onPick: (q: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pb-1">
      {followups.map((q, i) => (
        <motion.button
          key={q + i}
          onClick={() => onPick(q)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.06 * i }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="px-3 py-2 min-h-11 rounded-full border border-border bg-secondary/60 hover:bg-secondary text-secondary-foreground text-xs transition-colors"
        >
          {q}
        </motion.button>
      ))}
    </div>
  );
}

export function EmptyState({
  config,
  reduce,
  resumeAvailable,
  onPick,
  onResume,
}: {
  config: WidgetConfig;
  reduce: boolean;
  resumeAvailable: boolean;
  onPick: (q: string) => void;
  onResume: () => void;
}) {
  return (
    <div className="py-4 px-1">
      <div className="size-10 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary mb-3">
        <Sparkles className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{config.greeting}</p>
      {config.intro && (
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{config.intro}</p>
      )}
      {resumeAvailable && (
        <button
          onClick={onResume}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-full border border-primary/30 bg-primary/10 text-foreground text-xs hover:bg-primary/15 transition-colors"
        >
          <History className="size-3.5 text-primary" />
          Pick up where you left off
        </button>
      )}
      {config.quickStarts.length > 0 && (
        <>
          <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground/80 font-medium mb-2">
            Popular questions
          </div>
          <div className="flex flex-wrap gap-1.5">
            {config.quickStarts.map((q, i) => (
              <motion.button
                key={q}
                onClick={() => onPick(q)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : 0.06 * i }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="px-3 py-2 min-h-11 rounded-full border border-border bg-secondary/60 hover:bg-secondary text-secondary-foreground text-xs transition-colors"
              >
                {q}
              </motion.button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
