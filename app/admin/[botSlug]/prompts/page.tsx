"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PROMPT_TEMPLATES } from "@/lib/prompt-templates";
import { cn } from "@/lib/utils";

type Prompt = {
  id: number;
  bot_id: number;
  name: string;
  content: string;
  created_at: number;
  updated_at: number;
};

function relTime(unix: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function PromptsPage() {
  const { botSlug } = useParams<{ botSlug: string }>();
  const api = `/api/admin/bots/${botSlug}/prompts`;

  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [botName, setBotName] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // editor dialog state (create + edit share it)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(() => {
    fetch(api)
      .then((r) => r.json())
      .then((d: { prompts: Prompt[]; activePromptId: number | null }) => {
        setPrompts(d.prompts);
        setActiveId(d.activePromptId);
      });
  }, [api]);
  useEffect(reload, [reload]);

  useEffect(() => {
    fetch(`/api/admin/bots/${botSlug}`)
      .then((r) => r.json())
      .then((d: { bot?: { name: string } }) => setBotName(d.bot?.name ?? ""));
  }, [botSlug]);

  function flash(kind: "ok" | "err", text: string) {
    if (kind === "ok") {
      setMsg(text);
      setErr(null);
      setTimeout(() => setMsg(null), 4000);
    } else {
      setErr(text);
      setMsg(null);
    }
  }

  async function activate(p: Prompt) {
    // Optimistic: the badge moves immediately, reverts on failure.
    const prev = activeId;
    setActiveId(p.id);
    try {
      const res = await fetch(`${api}/${p.id}/activate`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json())?.error ?? `Failed: ${res.status}`);
    } catch (e) {
      setActiveId(prev);
      flash("err", e instanceof Error ? e.message : String(e));
    }
  }

  async function duplicate(p: Prompt) {
    try {
      const res = await fetch(`${api}/${p.id}/duplicate`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Failed: ${res.status}`);
      flash("ok", `Duplicated as “${j.prompt.name}”`);
      reload();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    }
  }

  function openCreate(template?: { label: string; prompt: string }) {
    setEditing(null);
    setDraftName(template?.label ?? "");
    setDraftContent(template?.prompt ?? "");
    setGalleryOpen(false);
    setEditorOpen(true);
  }

  function openEdit(p: Prompt) {
    setEditing(p);
    setDraftName(p.name);
    setDraftContent(p.content);
    setEditorOpen(true);
  }

  async function saveDraft() {
    setSavingDraft(true);
    try {
      const res = editing
        ? await fetch(`${api}/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: draftName, content: draftContent }),
          })
        : await fetch(api, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: draftName, content: draftContent }),
          });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Failed: ${res.status}`);
      flash("ok", editing ? "Prompt updated." : `Created “${j.prompt.name}”.`);
      setEditorOpen(false);
      reload();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDraft(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${api}/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Delete failed: ${res.status}`);
      }
      flash("ok", `Deleted “${pendingDelete.name}”.`);
      setPendingDelete(null);
      reload();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Keep several personas; exactly one is <em>active</em> and drives every answer.
            Edit updates in place — switch instantly, no redeploys.
          </p>
        </div>
        <Button onClick={() => setGalleryOpen(true)}>
          <Plus className="size-4" />
          New prompt
        </Button>
      </div>

      {msg && (
        <Alert className="mt-4 border-success/40 bg-success/10 text-foreground">
          <CheckCircle2 className="size-4 text-success" />
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}
      {err && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6 space-y-3">
        {prompts === null ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading prompts">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl shimmer" />
            ))}
          </div>
        ) : prompts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No prompts yet — create one from a template to give your bot a voice.
            </CardContent>
          </Card>
        ) : (
          prompts.map((p) => {
            const isActive = p.id === activeId;
            return (
              <Card
                key={p.id}
                className={cn(
                  "transition-colors",
                  isActive && "border-primary/40 ring-1 ring-primary/20"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {p.name}
                        </span>
                        {isActive && (
                          <Badge className="bg-primary/15 text-primary border-primary/40 hover:bg-primary/15">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Updated {relTime(p.updated_at)}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground/90 line-clamp-2 leading-relaxed max-w-2xl whitespace-pre-wrap">
                        {p.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isActive && (
                        <Button size="sm" variant="secondary" onClick={() => activate(p)}>
                          Activate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(p)}
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicate(p)}
                        aria-label={`Duplicate ${p.name}`}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(p)}
                        disabled={isActive}
                        title={isActive ? "Activate another prompt first" : undefined}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Template gallery */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New prompt</DialogTitle>
            <DialogDescription>
              Start from a persona template — you can edit every word before saving — or
              start blank.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {PROMPT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openCreate({ label: t.label, prompt: t.prompt(botName || "this bot") })}
                className="text-left p-3.5 min-h-11 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group"
              >
                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Sparkles className="size-3.5 text-primary opacity-60 group-hover:opacity-100" />
                  {t.label}
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {t.description}
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => openCreate()}
              className="text-left p-3.5 min-h-11 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <div className="text-sm font-medium text-foreground">Start blank</div>
              <div className="text-xs text-muted-foreground mt-1">
                Write the whole prompt yourself.
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!savingDraft) setEditorOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit “${editing.name}”` : "New prompt"}</DialogTitle>
            <DialogDescription>
              Knowledge-base context and citation instructions are appended automatically
              at question time — write only the persona and rules here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Friendly support"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prompt</Label>
              <Textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={12}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={savingDraft}>
              Cancel
            </Button>
            <Button
              onClick={saveDraft}
              disabled={savingDraft || !draftName.trim() || !draftContent.trim()}
            >
              {savingDraft ? "Saving…" : editing ? "Save changes" : "Create prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{pendingDelete?.name}”?</DialogTitle>
            <DialogDescription>
              The prompt text is gone for good. Conversations already answered with it are
              unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <span className="size-4 border-2 border-destructive-foreground/40 border-t-destructive-foreground rounded-full animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
