"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceInputState =
  | "idle"
  | "requesting" // permission prompt is up
  | "recording"
  | "transcribing"
  | "blocked" // NotAllowedError — persistent until page context changes
  | "error"; // transient (network, sidecar down)

const MAX_RECORDING_MS = 60_000;
// Hands-free VAD gate: RMS above START counts as speech; once speech was
// heard, SILENCE_MS of quiet auto-stops the recording.
const VAD_START_RMS = 0.02;
const VAD_SILENCE_MS = 1200;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return ""; // let the browser pick its default
}

/**
 * Recorder: mic → MediaRecorder → POST /api/stt → transcript.
 *
 * Push-to-talk (vad: false): caller stops explicitly; the transcript lands via
 * onTranscript for the composer (editable-before-send contract).
 * Hands-free (vad: true): auto-stops after silence once speech was heard.
 * An empty/cancelled-less stop still fires onTranscript("", "") so hands-free
 * callers can count strikes and re-arm.
 */
export function useVoiceInput({
  botKey,
  vad = false,
  onTranscript,
}: {
  botKey: string;
  vad?: boolean;
  onTranscript: (text: string, language: string) => void;
}) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0); // 0..1 input RMS for the pulse dot
  const [errorMessage, setErrorMessage] = useState("");

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timersRef = useRef<{ tick?: ReturnType<typeof setInterval>; max?: ReturnType<typeof setTimeout> }>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const heardSpeechRef = useRef(false);
  const silenceSinceRef = useRef<number | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const cleanupMedia = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (timersRef.current.tick) clearInterval(timersRef.current.tick);
    if (timersRef.current.max) clearTimeout(timersRef.current.max);
    timersRef.current = {};
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    recorderRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanupMedia, [cleanupMedia]);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const form = new FormData();
        form.append("botKey", botKey);
        form.append("audio", blob, "recording");
        const res = await fetch("/api/stt", { method: "POST", body: form });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Transcription failed (${res.status})`);
        }
        const data = (await res.json()) as { text: string; language: string; confidence: number };
        setState("idle");
        onTranscriptRef.current(data.text, data.confidence >= 0.6 ? data.language : "");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Transcription failed");
        setState("error");
        setTimeout(() => setState((s) => (s === "error" ? "idle" : s)), 4000);
      }
    },
    [botKey]
  );

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  const start = useCallback(async () => {
    if (!supported || state === "recording" || state === "transcribing") return;
    setErrorMessage("");
    cancelledRef.current = false;
    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("blocked");
      } else {
        setErrorMessage("Couldn't access the microphone");
        setState("error");
        setTimeout(() => setState((s) => (s === "error" ? "idle" : s)), 4000);
      }
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      const wasCancelled = cancelledRef.current;
      cleanupMedia();
      if (wasCancelled) {
        setState("idle");
        return;
      }
      if (blob.size === 0) {
        setState("idle");
        onTranscriptRef.current("", "");
        return;
      }
      void transcribe(blob);
    };

    // Level meter for the recording pulse — real input, never a fake loop.
    try {
      type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        let lastPush = 0;
        heardSpeechRef.current = false;
        silenceSinceRef.current = null;
        const loop = (t: number) => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          if (t - lastPush > 100) {
            setLevel(Math.min(1, rms * 4));
            lastPush = t;
          }
          if (vad && recorderRef.current?.state === "recording") {
            if (rms > VAD_START_RMS) {
              heardSpeechRef.current = true;
              silenceSinceRef.current = null;
            } else if (heardSpeechRef.current) {
              silenceSinceRef.current ??= t;
              if (t - silenceSinceRef.current > VAD_SILENCE_MS) {
                stop();
                return; // recorder.onstop finishes the flow
              }
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      }
    } catch {
      // level meter is progressive enhancement only
    }

    const startedAt = Date.now();
    setElapsed(0);
    timersRef.current.tick = setInterval(() => setElapsed(Date.now() - startedAt), 500);
    timersRef.current.max = setTimeout(() => stop(), MAX_RECORDING_MS);

    rec.start();
    setState("recording");
  }, [supported, state, cleanupMedia, transcribe, stop]);

  return { supported, state, elapsed, level, errorMessage, start, stop, cancel };
}
