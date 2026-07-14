"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TtsPlayerState = { id: string; status: "loading" | "playing" } | null;

/** Thrown by fetchTtsAudio when no voice exists for the reply's language. */
export class TtsLanguageUnsupportedError extends Error {
  constructor(public language: string) {
    super("language_unsupported");
  }
}

/**
 * Fetches synthesized audio for a reply. Prefers the persisted serverId (the
 * server then ignores client text); falls back to raw text for un-persisted
 * content. Throws TtsLanguageUnsupportedError on 422.
 */
export async function fetchTtsAudio(
  botKey: string,
  reply: { text: string; serverId?: number; language?: string }
): Promise<Blob> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      botKey,
      messageId: reply.serverId,
      text: reply.serverId ? undefined : reply.text,
      language: reply.language || undefined,
    }),
  });
  if (res.status === 422) {
    const j = (await res.json().catch(() => ({}))) as { language?: string };
    throw new TtsLanguageUnsupportedError(j.language ?? reply.language ?? "");
  }
  if (!res.ok) throw new Error(`tts failed (${res.status})`);
  return res.blob();
}

// Tiny silent WAV — played muted on the first user gesture so later
// programmatic play() calls (auto-speak from an SSE handler) aren't blocked
// by autoplay policies (Safari especially).
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

/**
 * One shared audio element per panel: starting any playback stops the
 * previous one; recording/sending should call stop() (barge-in).
 */
export function useTtsPlayer() {
  const [state, setState] = useState<TtsPlayerState>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const unlockedRef = useRef(false);
  const playSeqRef = useRef(0);
  const onEndedRef = useRef<(() => void) | null>(null);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "auto";
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  const releaseUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    playSeqRef.current++;
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
    }
    releaseUrl();
    onEndedRef.current = null;
    setState(null);
  }, [releaseUrl]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      releaseUrl();
      audioRef.current = null;
    };
  }, [releaseUrl]);

  /** Call from any real user gesture inside the panel (focus, click, mic press). */
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    try {
      const el = getAudio();
      el.muted = true;
      el.src = SILENT_WAV;
      void el
        .play()
        .catch(() => {})
        .finally(() => {
          el.muted = false;
        });
    } catch {
      // unlock is best-effort
    }
  }, [getAudio]);

  /**
   * Fetches audio and plays it. Resolves true when playback started, false
   * when it failed (caller downgrades to a visible play button silently).
   */
  const play = useCallback(
    async (id: string, fetchAudio: () => Promise<Blob>, onEnded?: () => void): Promise<boolean> => {
      stop();
      const seq = ++playSeqRef.current;
      setState({ id, status: "loading" });
      let blob: Blob;
      try {
        blob = await fetchAudio();
      } catch {
        if (playSeqRef.current === seq) setState(null);
        return false;
      }
      if (playSeqRef.current !== seq) return false; // superseded meanwhile

      const el = getAudio();
      releaseUrl();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      onEndedRef.current = onEnded ?? null;
      el.onended = () => {
        if (playSeqRef.current !== seq) return;
        releaseUrl();
        setState(null);
        onEndedRef.current?.();
        onEndedRef.current = null;
      };
      el.onerror = () => {
        if (playSeqRef.current !== seq) return;
        releaseUrl();
        setState(null);
      };
      el.src = url;
      try {
        await el.play();
      } catch {
        // Autoplay blocked or decode failure — degrade silently.
        if (playSeqRef.current === seq) {
          releaseUrl();
          setState(null);
        }
        return false;
      }
      if (playSeqRef.current === seq) setState({ id, status: "playing" });
      return true;
    },
    [stop, getAudio, releaseUrl]
  );

  return { state, play, stop, unlock };
}
