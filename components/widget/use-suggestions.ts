"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "./types";

/**
 * Debounced typing-autocomplete against /api/suggest.
 *
 * - Depends on the trimmed input only; history is read through a ref at fire
 *   time, so streaming tokens never tear the debounce down (BUG-07).
 * - highlightIdx is set exclusively by keyboard navigation — hover is visual
 *   only, so a resting pointer can't hijack Enter (BUG-06).
 * - Accepting a suggestion into the input suppresses the next suggest cycle,
 *   so Tab-complete doesn't pop the dropdown back open (BUG-08).
 */
export function useSuggestions({
  botKey,
  input,
  loading,
  messagesRef,
}: {
  botKey: string;
  input: string;
  loading: boolean;
  messagesRef: React.MutableRefObject<Message[]>;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const suppressRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = input.trim();

    if (suppressRef.current !== null) {
      if (trimmed === suppressRef.current.trim()) return;
      suppressRef.current = null;
    }

    if (trimmed.length < 3 || loading) {
      abortRef.current?.abort();
      setSuggestions((prev) => (prev.length > 0 ? [] : prev));
      setOpen(false);
      setHighlightIdx(-1);
      return;
    }

    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            botKey,
            partial: trimmed,
            history: messagesRef.current
              .filter((m) => !m.kind)
              .slice(-4)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        if (!res.ok) return;
        const j = (await res.json()) as { suggestions: string[] };
        if (ctrl.signal.aborted) return;
        const next = (j.suggestions ?? []).slice(0, 3);
        setSuggestions(next);
        setOpen(next.length > 0);
        setHighlightIdx(-1);
      } catch {
        // aborted or network failure — silently ignore
      }
    }, 250);
    return () => clearTimeout(t);
  }, [input, loading, botKey, messagesRef]);

  /** Put a suggestion in the composer without reopening the dropdown. */
  function accept(value: string) {
    suppressRef.current = value;
    setOpen(false);
    setHighlightIdx(-1);
  }

  function close() {
    setOpen(false);
    setHighlightIdx(-1);
  }

  return { suggestions, open, highlightIdx, setHighlightIdx, accept, close };
}
