"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Headphones,
  MessageSquare,
  Mic,
  MicOff,
  MoreHorizontal,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Citation, Message, WidgetConfig } from "./types";
import { useSuggestions } from "./use-suggestions";
import { Bubble, CitationDisclosure, EmptyState, ErrorBubble, FollowupChips } from "./messages";
import { InlineSupportForm } from "./support-sheet";
import { useVoiceInput } from "./use-voice-input";
import { fetchTtsAudio, TtsLanguageUnsupportedError, useTtsPlayer } from "./use-tts-player";
import { RecordingBar, VoiceModeOverlay, type VoiceOverlayState } from "./voice-mode";

type VoiceCaps = {
  available: boolean;
  stt: boolean;
  tts: boolean;
  handsfree: boolean;
  autoplay: boolean;
  languages: string[];
};

// Words/phrases that strongly signal the user wants a real person.
const FRUSTRATION_RE =
  /\b(human|real person|talk to (someone|a human|an agent)|speak to (a |an )?(human|agent|person|representative)|not helpful|useless|doesn'?t (help|work)|frustrat|escalate|manager|refund)\b/i;

function isSubstantive(text: string): boolean {
  return text.includes("?") || text.trim().split(/\s+/).length > 8;
}

/**
 * Tier-1 escalation signals (BUG-01 fix — the old "2+ user messages" volume
 * gate is gone). The link renders under the last settled reply only, and
 * disappears on its own when the next answer lands with citations.
 */
function shouldOfferEscalation(real: Message[]): boolean {
  const last = [...real].reverse().find((m) => m.role === "assistant");
  if (!last || last.streaming) return false;
  const lastUser = real
    .slice(0, real.indexOf(last))
    .reverse()
    .find((m) => m.role === "user");
  const zeroCitations = (m: Message) => (m.citations?.length ?? 0) === 0;

  if (lastUser && FRUSTRATION_RE.test(lastUser.content)) return true;
  if (zeroCitations(last) && lastUser && isSubstantive(lastUser.content)) return true;
  const settledReplies = real.filter((m) => m.role === "assistant" && !m.streaming);
  if (settledReplies.length >= 2 && settledReplies.slice(-2).every(zeroCitations)) return true;
  if (real.filter((m) => m.role === "user").length >= 4) return true;
  return false;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function ChatWidget({
  config,
  mode = "floating",
}: {
  config: WidgetConfig;
  mode?: "floating" | "embedded";
}) {
  const [open, setOpen] = useState(mode === "embedded");
  const [unread, setUnread] = useState(0);
  const openRef = useRef(open);
  openRef.current = open;

  const themeVars = {
    "--primary": config.primaryColor,
    "--ring": config.primaryColor,
  } as React.CSSProperties;

  const launcherRef = useRef<HTMLButtonElement>(null);

  if (mode === "embedded") {
    return (
      <div className="contents" style={themeVars}>
        <ChatPanel config={config} mode="embedded" onClose={() => {}} onReplyWhileClosed={() => {}} />
      </div>
    );
  }

  return (
    <div className="contents" style={themeVars}>
      {/* Floating launcher — Fitts's Law: 56px target, always visible bottom-right */}
      <motion.button
        ref={launcherRef}
        onClick={() => {
          setOpen((v) => !v);
          setUnread(0);
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-50 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-xl shadow-primary/30 ring-1 ring-primary/40 flex items-center justify-center text-primary-foreground"
        aria-label={open ? `Close ${config.name} chat` : `Open ${config.name} chat`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex"
            >
              <X className="size-5" />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex"
            >
              <MessageSquare className="size-5" />
            </motion.span>
          )}
        </AnimatePresence>
        {!open && unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold flex items-center justify-center"
            aria-label={`${unread} unread repl${unread === 1 ? "y" : "ies"}`}
          >
            {unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <ChatPanel
            key="panel"
            config={config}
            mode="floating"
            onClose={() => {
              setOpen(false);
              launcherRef.current?.focus();
            }}
            onReplyWhileClosed={() => {
              if (!openRef.current) setUnread((u) => u + 1);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatPanel({
  config,
  mode,
  onClose,
  onReplyWhileClosed,
}: {
  config: WidgetConfig;
  mode: "floating" | "embedded";
  onClose: () => void;
  onReplyWhileClosed: () => void;
}) {
  const storageKey = `sk:convo:${config.botKey}`;

  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [waitingFirstToken, setWaitingFirstToken] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [showNewReply, setShowNewReply] = useState(false);

  // ---- voice state -------------------------------------------------------
  const [voiceCaps, setVoiceCaps] = useState<VoiceCaps | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [audioUnavailableIds, setAudioUnavailableIds] = useState<Set<string>>(new Set());
  const hfStrikesRef = useRef(0); // consecutive empty hands-free rounds
  const spokenIdsRef = useRef(new Set<string>());
  const autoSpeakCandidateRef = useRef<string | null>(null);
  const voiceModeRef = useRef(voiceMode);
  voiceModeRef.current = voiceMode;

  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const suggest = useSuggestions({
    botKey: config.botKey,
    input,
    loading,
    messagesRef,
  });

  // ---- voice hooks -------------------------------------------------------
  const tts = useTtsPlayer();
  const ttsBusy = tts.state !== null;

  // Push-to-talk: transcript lands in the composer, editable before send.
  const vi = useVoiceInput({
    botKey: config.botKey,
    onTranscript: (text, lang) => {
      if (!text.trim()) return;
      setInput(text);
      setDetectedLanguage(lang);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  });

  // Hands-free: VAD-stopped utterances are sent immediately (no edit step).
  const hf = useVoiceInput({
    botKey: config.botKey,
    vad: true,
    onTranscript: (text, lang) => {
      if (!voiceModeRef.current) return;
      if (!text.trim()) {
        hfStrikesRef.current += 1;
        if (hfStrikesRef.current >= 2) {
          exitVoiceMode(true);
        }
        // one strike: the arming effect re-listens via hf.state → "idle"
        return;
      }
      hfStrikesRef.current = 0;
      void send(text, lang);
    },
  });

  function markAudioUnavailable(id: string) {
    setAudioUnavailableIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  /** Play (or toggle off) a settled reply. Failures degrade silently. */
  function speak(m: Message) {
    if (!voiceCaps?.tts || !m.content) return;
    if (tts.state?.id === m.id) {
      tts.stop();
      return;
    }
    void tts.play(m.id, () =>
      fetchTtsAudio(config.botKey, {
        text: m.content,
        serverId: m.serverId,
        language: m.language,
      }).catch((err) => {
        if (err instanceof TtsLanguageUnsupportedError) markAudioUnavailable(m.id);
        throw err;
      })
    );
  }

  function enterVoiceMode() {
    tts.unlock();
    hfStrikesRef.current = 0;
    setMenuOpen(false);
    setVoiceMode(true);
  }

  function exitVoiceMode(withHint = false) {
    setVoiceMode(false);
    hfStrikesRef.current = 0;
    hf.cancel();
    tts.stop();
    if (withHint) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          kind: "note",
          content: "Voice mode paused — tap the mic or type instead.",
        },
      ]);
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // Capability probe — one fetch per panel mount, gated on the bot flag.
  useEffect(() => {
    if (!config.voice?.enabled) return;
    let alive = true;
    fetch(`/api/voice/health?botKey=${encodeURIComponent(config.botKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { voice?: VoiceCaps } | null) => {
        if (alive && j?.voice?.available) setVoiceCaps(j.voice);
      })
      .catch(() => {
        // sidecar down — widget simply renders no voice affordances
      });
    return () => {
      alive = false;
    };
  }, [config.botKey, config.voice?.enabled]);

  // Hands-free conversation loop (half-duplex): listen only while the bot is
  // neither thinking nor speaking; the mic is physically off during playback.
  const hfArmed = voiceMode && !loading && !ttsBusy && hf.state !== "blocked";
  useEffect(() => {
    if (!voiceMode) return;
    if (hfArmed && hf.state === "idle") {
      void hf.start();
    } else if (!hfArmed && hf.state === "recording") {
      hf.cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode, hfArmed, hf.state]);

  // Auto-speak: the reply that just settled from a live stream — never
  // restored history. Opt-in per bot (autoplay) or implicit in voice mode.
  useEffect(() => {
    if (!voiceCaps?.tts || !(voiceMode || voiceCaps.autoplay)) return;
    const candidate = autoSpeakCandidateRef.current;
    if (!candidate || spokenIdsRef.current.has(candidate)) return;
    const m = messages.find((x) => x.id === candidate);
    if (!m || m.streaming || !m.content) return;
    spokenIdsRef.current.add(candidate);
    speak(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceMode, voiceCaps]);

  // Focus contract: opening the dialog moves focus into the composer (BUG-09).
  useEffect(() => {
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, []);

  // Offer conversation resume if a previous session left one behind.
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) setResumeAvailable(true);
    } catch {
      // storage unavailable (private mode / partitioned iframe) — skip resume
    }
  }, [storageKey]);

  // Clicking anywhere outside the header menu dismisses it.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-sk-menu]")) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  // Scroll pinning (BUG-02): only auto-scroll while the user is at the bottom.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pinned = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    pinnedRef.current = pinned;
    if (pinned) setShowNewReply(false);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pinnedRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    } else {
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant" && last.content) setShowNewReply(true);
    }
  }, [messages, waitingFirstToken, supportOpen, reduce]);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    pinnedRef.current = true;
    setShowNewReply(false);
  }

  async function streamTurn(history: Message[], language?: string) {
    // Reply language mirrors the server's resolution: a fixed bot language
    // wins; 'auto' follows the detected spoken language of this turn.
    const replyLanguage =
      config.voice && config.voice.language !== "auto"
        ? config.voice.language
        : language ?? "";
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      citations: [],
      streaming: true,
      language: replyLanguage || undefined,
    };
    setMessages([...history, assistantMsg]);
    setLoading(true);
    setWaitingFirstToken(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botKey: config.botKey,
          conversationId,
          language: language || undefined,
          messages: history
            .filter((m) => !m.kind)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        try {
          throw new Error((JSON.parse(text) as { error?: string }).error || text);
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(text || `Request failed: ${res.status}`);
          throw e;
        }
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const lines = evt.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const eventName = eventLine.slice(6).trim();
          const data = dataLine.slice(5).trim();
          if (eventName === "conversation") {
            const { id } = JSON.parse(data) as { id: string };
            setConversationId(id);
            try {
              localStorage.setItem(storageKey, id);
            } catch {
              // storage unavailable — resume just won't be offered
            }
          } else if (eventName === "citations") {
            const citations = JSON.parse(data) as Citation[];
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, citations } : m))
            );
          } else if (eventName === "followups") {
            const followups = JSON.parse(data) as string[];
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, followups } : m))
            );
          } else if (eventName === "delta") {
            const { text } = JSON.parse(data) as { text: string };
            if (text) setWaitingFirstToken(false);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: m.content + text } : m
              )
            );
          } else if (eventName === "message") {
            const { id } = JSON.parse(data) as { id: number };
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, serverId: id } : m))
            );
          } else if (eventName === "error") {
            const { message } = JSON.parse(data) as { message: string };
            throw new Error(message);
          } else if (eventName === "done") {
            autoSpeakCandidateRef.current = assistantMsg.id;
            onReplyWhileClosed();
          }
        }
      }
    } catch (err) {
      // The failed turn stays visible: drop only the empty streaming bubble,
      // add an inline error with Retry, and put the text back in the composer.
      const message = err instanceof Error ? err.message : String(err);
      const lastUser = [...history].reverse().find((m) => m.role === "user" && !m.kind);
      setMessages((prev) => [
        ...prev.filter((m) => !(m.id === assistantMsg.id && !m.content)),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          kind: "error",
          content: message,
          retryText: lastUser?.content,
        },
      ]);
      if (lastUser) setInput(lastUser.content);
    } finally {
      setLoading(false);
      setWaitingFirstToken(false);
      setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
    }
  }

  async function send(textOverride?: string, languageOverride?: string) {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || loading) return;
    tts.stop(); // barge-in: a new question always silences the previous answer
    const language = languageOverride ?? detectedLanguage;
    setDetectedLanguage("");
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      language: language || undefined,
    };
    setInput("");
    suggest.close();
    await streamTurn([...messagesRef.current, userMsg], language || undefined);
  }

  function retry(errorId: string) {
    if (loading) return;
    const history = messagesRef.current.filter((m) => m.id !== errorId);
    setInput("");
    void streamTurn(history);
  }

  async function resume() {
    let id: string | null = null;
    try {
      id = localStorage.getItem(storageKey);
    } catch {
      return;
    }
    if (!id) return;
    setResumeAvailable(false);
    try {
      const res = await fetch(
        `/api/conversations/${id}?botKey=${encodeURIComponent(config.botKey)}`
      );
      if (!res.ok) {
        localStorage.removeItem(storageKey);
        return;
      }
      const j = (await res.json()) as {
        conversation: { id: string };
        messages: { role: "user" | "assistant"; content: string; citations: Citation[] | null }[];
      };
      setConversationId(j.conversation.id);
      setMessages(
        j.messages.map((m, i) => ({
          id: `restored-${i}`,
          role: m.role,
          content: m.content,
          citations: m.citations ?? undefined,
        }))
      );
    } catch {
      // network failure — leave the empty state as-is
    }
  }

  function startOver() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // nothing stored to clear
    }
    setMessages([]);
    setConversationId(null);
    setSupportOpen(false);
    setResumeAvailable(false);
    setMenuOpen(false);
    inputRef.current?.focus();
  }

  function handleSupportSubmitted(email: string, ticketId: number) {
    setSupportOpen(false);
    const note: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "note",
      content: `✓ Ticket #${ticketId} — a human will reply to ${email}. Feel free to keep asking, I'll help in the meantime.`,
    };
    setMessages((prev) => [...prev, note]);
  }

  function buildPrefilledMessage(): string {
    const real = messagesRef.current.filter((m) => !m.kind);
    const lastUser = [...real].reverse().find((m) => m.role === "user");
    const lastAssistant = [...real].reverse().find((m) => m.role === "assistant");
    let prefill = "";
    if (lastUser) prefill += `Asked: ${lastUser.content}\n\n`;
    if (lastAssistant && lastAssistant.content) {
      const reply =
        lastAssistant.content.length > 300
          ? lastAssistant.content.slice(0, 300) + "…"
          : lastAssistant.content;
      prefill += `Bot replied: ${reply}\n\n`;
    }
    prefill += `---\nMy issue:\n`;
    return prefill;
  }

  // Dialog keyboard contract: Esc peels one layer at a time; Tab stays inside.
  function handlePanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      if (voiceMode) {
        exitVoiceMode();
      } else if (suggest.open) {
        suggest.close();
      } else if (menuOpen) {
        setMenuOpen(false);
      } else if (supportOpen) {
        setSupportOpen(false);
      } else if (mode === "floating") {
        onClose();
      }
      e.stopPropagation();
      return;
    }
    if (e.key === "Tab" && mode === "floating") {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Escalation + follow-ups attach to the last settled assistant reply.
  const real = messages.filter((m) => !m.kind);
  const lastAssistant = [...real].reverse().find((m) => m.role === "assistant");
  const lastAssistantFollowups =
    lastAssistant && !lastAssistant.streaming ? lastAssistant.followups ?? [] : [];
  const offerEscalation = shouldOfferEscalation(real);
  // One suggestion surface at a time: quick-starts (empty) XOR autocomplete
  // (typing) XOR follow-ups (idle after an answer).
  const showFollowups =
    lastAssistantFollowups.length > 0 && !suggest.open && !supportOpen && input.trim() === "";

  // ---- voice derived state ----------------------------------------------
  const micAvailable = !!voiceCaps?.stt && vi.supported;
  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  const micBlockedHint = inIframe
    ? "Microphone is blocked. The site embedding this chat must allow microphone access."
    : "Microphone is blocked — allow it in your browser settings.";
  const handsfreeAvailable = !!voiceCaps?.handsfree && vi.supported;
  const overlayState: VoiceOverlayState =
    hf.state === "blocked"
      ? "blocked"
      : loading
        ? "thinking"
        : ttsBusy
          ? "speaking"
          : hf.state === "transcribing"
            ? "transcribing"
            : hf.state === "error"
              ? "error"
              : "listening";
  const lastUserMsg = [...real].reverse().find((m) => m.role === "user");
  const overlayCaption =
    overlayState === "thinking" || overlayState === "speaking"
      ? lastAssistant?.content ?? ""
      : overlayState === "listening"
        ? lastUserMsg?.content ?? ""
        : "";

  function handleOrbTap() {
    if (overlayState === "speaking") {
      tts.stop(); // interrupt → arming effect re-listens
    } else if (overlayState === "listening") {
      hf.stop(); // close the utterance now
    } else if (overlayState === "blocked" || overlayState === "error") {
      void hf.start();
    }
  }

  return (
    <motion.div
      ref={panelRef}
      initial={mode === "floating" ? { opacity: 0, y: 16, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={mode === "floating" ? { opacity: 0, y: 16, scale: 0.98 } : undefined}
      transition={
        reduce ? { duration: 0.15 } : { type: "spring", stiffness: 360, damping: 30 }
      }
      className={cn(
        "flex flex-col bg-card border border-border overflow-hidden",
        mode === "floating"
          ? // dvh, not vh: the iOS keyboard shrinks the dynamic viewport (BUG-10)
            "fixed bottom-[max(6rem,calc(env(safe-area-inset-bottom)+4.75rem))] right-[max(1.25rem,env(safe-area-inset-right))] z-50 w-[calc(100vw-2.5rem)] sm:w-[420px] h-[60dvh] max-h-[calc(100dvh-7rem)] rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-md"
          : "relative h-full w-full"
      )}
      role="dialog"
      aria-modal={mode === "floating" ? true : undefined}
      aria-label={`${config.name} chat`}
      onKeyDown={handlePanelKeyDown}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/15 via-card to-card">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
            <Sparkles className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{config.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="relative inline-flex size-1.5">
                <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
                <span className="relative inline-block size-1.5 rounded-full bg-success" />
              </span>
              Online — usually answers in seconds
            </div>
          </div>
          {handsfreeAvailable && (
            <button
              onClick={enterVoiceMode}
              aria-label="Start a voice conversation"
              title="Voice conversation"
              className="size-11 -my-1.5 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Headphones className="size-4" />
            </button>
          )}
          {/* Tier-0: help is always reachable from here, so replies never beg */}
          <div className="relative" data-sk-menu>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More options"
              className="size-11 -my-1.5 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <MoreHorizontal className="size-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: reduce ? 0.05 : 0.12 }}
                  role="menu"
                  className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl shadow-black/40 overflow-hidden z-20"
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setSupportOpen(true);
                    }}
                    className="w-full text-left px-3 py-2.5 min-h-11 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <UserRound className="size-4 text-muted-foreground" />
                    Talk to a person
                  </button>
                  <button
                    role="menuitem"
                    onClick={startOver}
                    disabled={messages.length === 0 && !resumeAvailable}
                    className="w-full text-left px-3 py-2.5 min-h-11 text-sm hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-40"
                  >
                    <RotateCcw className="size-4 text-muted-foreground" />
                    Start over
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages — aria-live so screen readers hear replies (BUG-09) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        className="relative flex-1 overflow-y-auto p-3 space-y-2.5"
      >
        {messages.length === 0 && (
          <EmptyState
            config={config}
            reduce={!!reduce}
            resumeAvailable={resumeAvailable}
            onPick={(q) => send(q)}
            onResume={resume}
          />
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 380, damping: 32, mass: 0.6 }
              }
              className={
                m.kind === "note"
                  ? "text-center"
                  : m.role === "user"
                    ? "text-right"
                    : "text-left"
              }
            >
              {m.kind === "note" ? (
                <div className="inline-block text-xs text-muted-foreground bg-success/10 border border-success/30 rounded-full px-3 py-1.5">
                  {m.content}
                </div>
              ) : m.kind === "error" ? (
                <ErrorBubble m={m} onRetry={() => retry(m.id)} />
              ) : (
                <>
                  <Bubble
                    m={m}
                    waitingFirstToken={waitingFirstToken && !!m.streaming}
                    onSpeak={
                      m.role === "assistant" && voiceCaps?.tts
                        ? () => {
                            tts.unlock();
                            speak(m);
                          }
                        : undefined
                    }
                    speakState={tts.state?.id === m.id ? tts.state.status : "idle"}
                    speakUnavailable={audioUnavailableIds.has(m.id)}
                  />
                  {m.role === "assistant" && m.citations && m.citations.length > 0 && (
                    <CitationDisclosure citations={m.citations} reduce={!!reduce} />
                  )}
                  {lastAssistant?.id === m.id && offerEscalation && !supportOpen && (
                    <div className="mt-2">
                      <button
                        onClick={() => setSupportOpen(true)}
                        className="inline-flex items-center gap-1 min-h-11 -my-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                      >
                        Still need help?{" "}
                        <span className="underline underline-offset-2">Talk to a person</span>
                        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {supportOpen && (
            <motion.div
              key="support"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              className="overflow-hidden"
            >
              <InlineSupportForm
                botKey={config.botKey}
                conversationId={conversationId}
                initialMessage={buildPrefilledMessage()}
                onCancel={() => setSupportOpen(false)}
                onSubmitted={handleSupportSubmitted}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* "New reply" pill — appears when content lands while scrolled up */}
      <AnimatePresence>
        {showNewReply && (
          <motion.button
            key="new-reply"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: reduce ? 0.05 : 0.15 }}
            onClick={scrollToBottom}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg shadow-primary/30"
          >
            <ArrowDown className="size-3.5" />
            New reply
          </motion.button>
        )}
      </AnimatePresence>

      {/* Hands-free voice mode — a lens over the log, never a replacement */}
      <AnimatePresence>
        {voiceMode && (
          <VoiceModeOverlay
            key="voice-mode"
            state={overlayState}
            level={hf.level}
            caption={overlayCaption}
            onOrbTap={handleOrbTap}
            onExit={() => exitVoiceMode()}
            reduce={!!reduce}
          />
        )}
      </AnimatePresence>

      {/* Composer */}
      <div className="relative border-t border-border bg-card">
        {showFollowups && (
          <div className="px-3 pt-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
              Try asking
            </div>
            <FollowupChips
              followups={lastAssistantFollowups}
              reduce={!!reduce}
              onPick={(q) => send(q)}
            />
          </div>
        )}
        <AnimatePresence>
          {suggest.open && suggest.suggestions.length > 0 && (
            <motion.div
              key="suggest"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: reduce ? 0 : 0.12 }}
              className="absolute left-3 right-3 bottom-full mb-2 rounded-xl border border-border bg-popover/95 text-popover-foreground shadow-xl shadow-black/40 backdrop-blur overflow-hidden z-10"
              role="listbox"
              id="sk-suggest-list"
            >
              {suggest.suggestions.map((s, i) => (
                <button
                  key={s + i}
                  type="button"
                  role="option"
                  id={`sk-suggest-opt-${i}`}
                  aria-selected={i === suggest.highlightIdx}
                  tabIndex={-1}
                  // Hover styling is CSS-only; it never sets the active option (BUG-06)
                  onMouseDown={(e) => {
                    e.preventDefault();
                    suggest.close();
                    send(s);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 min-h-11 text-sm transition-colors flex items-center gap-2 hover:bg-muted",
                    i === suggest.highlightIdx && "bg-primary/15 text-foreground"
                  )}
                >
                  <Sparkles className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Enter sends the keyboard-highlighted option, otherwise the typed text
            if (
              suggest.open &&
              suggest.highlightIdx >= 0 &&
              suggest.suggestions[suggest.highlightIdx]
            ) {
              const pick = suggest.suggestions[suggest.highlightIdx];
              suggest.close();
              send(pick);
            } else {
              suggest.close();
              send();
            }
          }}
          className="p-3 flex items-center gap-2"
        >
          {vi.state === "recording" ? (
            <RecordingBar
              elapsed={vi.elapsed}
              level={vi.level}
              onCancel={vi.cancel}
              onStop={vi.stop}
              reduce={!!reduce}
            />
          ) : (
          <>
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onFocus={tts.unlock}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (!suggest.open || suggest.suggestions.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                suggest.setHighlightIdx((i) => (i + 1) % suggest.suggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                suggest.setHighlightIdx((i) => (i <= 0 ? suggest.suggestions.length : i) - 1);
              } else if (e.key === "Tab") {
                const pick =
                  suggest.suggestions[suggest.highlightIdx >= 0 ? suggest.highlightIdx : 0];
                if (pick) {
                  e.preventDefault();
                  suggest.accept(pick);
                  setInput(pick);
                }
              }
            }}
            onBlur={() => {
              setTimeout(() => suggest.close(), 150);
            }}
            placeholder={vi.state === "transcribing" ? "Transcribing…" : config.placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={suggest.open && suggest.suggestions.length > 0}
            aria-controls="sk-suggest-list"
            aria-autocomplete="list"
            aria-activedescendant={
              suggest.open && suggest.highlightIdx >= 0
                ? `sk-suggest-opt-${suggest.highlightIdx}`
                : undefined
            }
            // Never disabled: composing the next question while the bot streams
            // is allowed; send() is gated on `loading` instead (BUG-03)
            className="flex-1 h-11"
          />
          {micAvailable && (
            <button
              type="button"
              onClick={() => {
                if (vi.state === "blocked") return;
                tts.unlock();
                tts.stop(); // barge-in
                if (vi.state === "idle" || vi.state === "error") void vi.start();
              }}
              aria-label={vi.state === "blocked" ? micBlockedHint : "Ask by voice"}
              aria-pressed={false}
              aria-disabled={vi.state === "blocked" || vi.state === "transcribing" || undefined}
              title={vi.state === "blocked" ? micBlockedHint : "Ask by voice"}
              className={cn(
                "size-11 shrink-0 rounded-lg border border-border bg-secondary/60 flex items-center justify-center transition-colors",
                vi.state === "blocked"
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {vi.state === "requesting" || vi.state === "transcribing" ? (
                <span
                  className="size-4 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin"
                  aria-hidden
                />
              ) : vi.state === "blocked" ? (
                <MicOff className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </button>
          )}
          <motion.div
            whileHover={!loading && input.trim() ? { scale: 1.04 } : undefined}
            whileTap={!loading && input.trim() ? { scale: 0.95 } : undefined}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="size-11 rounded-lg"
            >
              {loading ? (
                <span className="size-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </motion.div>
          </>
          )}
        </form>
      </div>
    </motion.div>
  );
}
