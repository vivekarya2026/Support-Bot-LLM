"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowRight, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

type SupportRequest = {
  id: number;
  conversation_id: string | null;
  email: string;
  message: string;
  status: "new" | "in_progress" | "resolved";
  created_at: number;
};

export default function SupportPage() {
  const { botSlug } = useParams<{ botSlug: string }>();
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);

  const reload = useCallback(() => {
    fetch(`/api/admin/bots/${botSlug}/support`)
      .then((r) => r.json())
      .then((d: { requests: SupportRequest[] }) => setRequests(d.requests));
  }, [botSlug]);
  useEffect(reload, [reload]);

  async function updateStatus(id: number, status: SupportRequest["status"]) {
    await fetch(`/api/admin/bots/${botSlug}/support/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    reload();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Support requests</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Users who escalated from the chatbot to a human. Update status as you work them.
      </p>

      <Card className="mt-6 overflow-hidden">
        {requests === null ? (
          <div className="p-4 space-y-2" aria-busy="true" aria-label="Loading requests">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-md shimmer" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="p-6 text-sm text-center text-muted-foreground">
            No requests yet. They&rsquo;ll show up here when the bot escalates.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-stack w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th className="text-left font-medium px-4 py-2.5">Email</th>
                  <th className="text-left font-medium px-4 py-2.5">Message</th>
                  <th className="text-left font-medium px-4 py-2.5">Conversation</th>
                  <th className="text-left font-medium px-4 py-2.5">When</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors align-top"
                  >
                    <td data-label="Status" className="px-4 py-3">
                      <StatusSelect
                        status={r.status}
                        onChange={(s) => updateStatus(r.id, s)}
                      />
                    </td>
                    <td data-label="Email" className="px-4 py-3 text-foreground break-all">
                      <a
                        className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                        href={`mailto:${r.email}`}
                      >
                        <Mail className="size-3.5 text-muted-foreground" />
                        {r.email}
                      </a>
                    </td>
                    <td data-label="Message" className="px-4 py-3 text-foreground/90 max-w-md">
                      <div className="whitespace-pre-wrap line-clamp-4 text-xs leading-relaxed">
                        {r.message}
                      </div>
                    </td>
                    <td data-label="Conversation" className="px-4 py-3 text-xs">
                      {r.conversation_id ? (
                        <Link
                          href={`/admin/${botSlug}/conversations/${r.conversation_id}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          View <ArrowRight className="size-3" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td data-label="When" className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.created_at * 1000).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusSelect({
  status,
  onChange,
}: {
  status: SupportRequest["status"];
  onChange: (s: SupportRequest["status"]) => void;
}) {
  const styles: Record<SupportRequest["status"], string> = {
    new: "bg-warning/15 border-warning/40 text-warning",
    in_progress: "bg-primary/15 border-primary/40 text-primary",
    resolved: "bg-success/15 border-success/40 text-success",
  };
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as SupportRequest["status"])}
      className={cn(
        "text-xs font-medium rounded-md border px-2 py-2 min-h-9 focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer",
        styles[status]
      )}
    >
      <option value="new">new</option>
      <option value="in_progress">in progress</option>
      <option value="resolved">resolved</option>
    </select>
  );
}
