"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Link as LinkIcon,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

type Doc = {
  id: number;
  source: string;
  kind: "md" | "txt" | "pdf" | "docx" | "url";
  created_at: number;
  chunk_count: number;
};

export default function DocsPage() {
  const { botSlug } = useParams<{ botSlug: string }>();
  const api = `/api/admin/bots/${botSlug}/docs`;

  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reindexing, setReindexing] = useState<Record<number, boolean>>({});
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    fetch(api)
      .then((r) => r.json())
      .then((d: { documents: Doc[] }) => setDocs(d.documents));
  }, [api]);

  useEffect(() => {
    reload();
  }, [reload]);

  function flash(kind: "ok" | "err", text: string) {
    if (kind === "ok") {
      setMsg(text);
      setErr(null);
      setTimeout(() => setMsg(null), 5000);
    } else {
      // Errors stay until the next action — no auto-dismiss.
      setErr(text);
      setMsg(null);
    }
  }

  async function uploadFiles(files: FileList) {
    setBusy(true);
    setErr(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${api}/upload`, { method: "POST", body: form });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error ?? `Upload failed: ${res.status}`);
        flash("ok", `Indexed ${j.source} (${j.chunkCount} chunks)`);
      }
      reload();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function uploadUrl() {
    if (!url) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${api}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Failed: ${res.status}`);
      flash("ok", `Indexed ${j.source} (${j.chunkCount} chunks)`);
      setUrl("");
      reload();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function reindex(doc: Doc) {
    setReindexing((m) => ({ ...m, [doc.id]: true }));
    try {
      const res = await fetch(`${api}/${doc.id}/reindex`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Re-index failed: ${res.status}`);
      flash("ok", `Re-crawled ${doc.source} (${j.chunkCount} chunks)`);
      reload();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setReindexing((m) => ({ ...m, [doc.id]: false }));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${api}?id=${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Delete failed: ${res.status}`);
      }
      flash("ok", `Deleted ${pendingDelete.source}`);
      setPendingDelete(null);
      reload();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function confirmReset() {
    setResetting(true);
    try {
      const res = await fetch(`${api}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: resetConfirm }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `Reset failed: ${res.status}`);
      flash(
        "ok",
        `Started fresh — removed ${j.removed.documents} document${
          j.removed.documents === 1 ? "" : "s"
        } and ${j.removed.chunks} chunks.`
      );
      setResetOpen(false);
      setResetConfirm("");
      reload();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Knowledge base</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Upload PDF, DOCX, Markdown, or plain text. Or crawl any URL. Files are indexed
        immediately — the bot uses them on the very next question.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
                <Upload className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">Upload file(s)</CardTitle>
                <CardDescription>.pdf, .docx, .md, .txt</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.md,.markdown,.txt"
              disabled={busy}
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:font-medium hover:file:bg-primary/90 file:cursor-pointer disabled:opacity-50"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary">
                <LinkIcon className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">Crawl a URL</CardTitle>
                <CardDescription>Fetches and indexes the page text.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com/docs"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
              />
              <Button onClick={uploadUrl} disabled={busy || !url} size="default">
                Crawl
              </Button>
            </div>
          </CardContent>
        </Card>
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

      <h2 className="mt-10 text-lg font-medium">Indexed documents</h2>
      <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground bg-success/10 border border-success/30 rounded-full px-3 py-1">
        <span className="relative inline-flex size-1.5">
          <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
          <span className="relative inline-block size-1.5 rounded-full bg-success" />
        </span>
        Uploads are indexed immediately. No publish step required.
      </div>

      <Card className="mt-3 overflow-hidden">
        {docs === null ? (
          <div className="p-4 space-y-2" aria-busy="true" aria-label="Loading documents">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-md shimmer" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="p-6 text-sm text-center text-muted-foreground">
            No documents yet — feed your bot. Upload files or crawl a URL above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-stack w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Source</th>
                  <th className="text-left font-medium px-4 py-2.5">Kind</th>
                  <th className="text-left font-medium px-4 py-2.5">Chunks</th>
                  <th className="text-left font-medium px-4 py-2.5">Indexed</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-foreground break-all">{d.source}</td>
                    <td data-label="Kind" className="px-4 py-2.5 text-muted-foreground font-mono text-xs uppercase">
                      {d.kind}
                    </td>
                    <td data-label="Chunks" className="px-4 py-2.5 text-muted-foreground">
                      {d.chunk_count}
                    </td>
                    <td className="stack-hide px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(d.created_at * 1000).toLocaleString()}
                    </td>
                    <td data-label="Status" className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-success bg-success/10 border border-success/30 rounded-full px-2 py-0.5">
                        <span className="size-1.5 rounded-full bg-success" />
                        Live
                      </span>
                    </td>
                    <td className="stack-row px-4 py-2.5 text-right whitespace-nowrap">
                      {d.kind === "url" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => reindex(d)}
                          disabled={reindexing[d.id]}
                          className="text-muted-foreground hover:text-foreground max-md:h-9"
                          title="Re-crawl this URL and refresh its chunks"
                        >
                          <RefreshCw
                            className={"size-3.5" + (reindexing[d.id] ? " animate-spin" : "")}
                          />
                          Re-index
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete(d)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 max-md:h-9"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Danger zone — physically distant from the primary actions above. */}
      <section className="mt-14">
        <h2 className="text-sm font-medium text-destructive uppercase tracking-wider">
          Danger zone
        </h2>
        <Card className="mt-3 border-destructive/30">
          <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" />
                Start fresh
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Remove every document, chunk, and embedding from this bot&rsquo;s
                knowledge base. Conversations and prompts are kept. This can&rsquo;t be
                undone.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setResetOpen(true)}
              disabled={docs !== null && docs.length === 0}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Start fresh…
            </Button>
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.source}?</DialogTitle>
            <DialogDescription>
              This removes {pendingDelete?.chunk_count} chunk
              {pendingDelete?.chunk_count === 1 ? "" : "s"} from the knowledge base. The
              bot will no longer be able to cite this document. This can&rsquo;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="default"
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

      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          if (!open && !resetting) {
            setResetOpen(false);
            setResetConfirm("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start fresh?</DialogTitle>
            <DialogDescription>
              This permanently wipes <strong>all documents and embeddings</strong> for
              this bot. Type <span className="font-mono text-foreground">{botSlug}</span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder={botSlug}
            className="font-mono"
            autoComplete="off"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetOpen(false);
                setResetConfirm("");
              }}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReset}
              disabled={resetting || resetConfirm !== botSlug}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? (
                <span className="size-4 border-2 border-destructive-foreground/40 border-t-destructive-foreground rounded-full animate-spin" />
              ) : (
                "Wipe knowledge base"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
