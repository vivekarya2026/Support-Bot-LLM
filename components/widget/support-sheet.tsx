"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Tier-2 escalation: one required field (email). The conversation summary is
 * auto-attached and stays collapsed under "Edit summary" so the form reads as
 * a single-step ask.
 */
export function InlineSupportForm({
  botKey,
  conversationId,
  initialMessage,
  onCancel,
  onSubmitted,
}: {
  botKey: string;
  conversationId: string | null;
  initialMessage: string;
  onCancel: () => void;
  onSubmitted: (email: string, ticketId: number) => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!email || !message.trim()) {
      setErr("Email is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botKey, email, message, conversationId }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: number; error?: string };
      if (!res.ok) {
        throw new Error(j?.error ?? `Failed: ${res.status}`);
      }
      onSubmitted(email, j.id ?? 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mt-3 p-3 rounded-xl border border-border bg-secondary/40 flex flex-col gap-2.5 text-sm"
    >
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-semibold text-foreground">Talk to a person</div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs min-h-11 -my-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        We&rsquo;ll attach this conversation so the human has full context.
      </p>
      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
        className="h-11"
      />
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground transition-colors min-h-11 flex items-center">
          Edit summary (attached automatically)
        </summary>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          className="mt-1.5 font-mono text-xs leading-relaxed resize-none"
        />
      </details>
      {err && <div className="text-xs text-destructive">{err}</div>}
      <Button type="submit" disabled={submitting} size="sm" className="self-end min-h-11">
        {submitting ? "Sending…" : "Send to support"}
      </Button>
    </form>
  );
}
