"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Loader2, AlertCircle, UserCheck, Clock } from "lucide-react";

type ActionStatus = "executing" | "awaiting_human_action" | "completed" | "failed";

interface TrackedAction {
  id: string;
  agent_type: string;
  recommendation: string;
  status: ActionStatus;
  actions_taken: string[];
  tools_used: string[];
  approved_by: string;
  approved_at: string;
  completed_at: string | null;
  station: string | null;
  severity: string | null;
  priority: string | null;
}

function StatusBadge({ status }: { status: ActionStatus }) {
  const map: Record<ActionStatus, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
    executing: {
      color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.3)",
      label: "Executing",
      icon: <Loader2 size={10} className="animate-spin" />,
    },
    awaiting_human_action: {
      color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)",
      label: "Awaiting Human Action",
      icon: <UserCheck size={10} />,
    },
    completed: {
      color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.3)",
      label: "Completed",
      icon: <CheckCircle2 size={10} />,
    },
    failed: {
      color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)",
      label: "Failed",
      icon: <AlertCircle size={10} />,
    },
  };
  const s = map[status] ?? map.executing;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}>
      {s.icon} {s.label}
    </span>
  );
}

function PriorityBadge({ severity }: { severity: string | null }) {
  if (severity === "critical") {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ backgroundColor: "rgba(248,113,113,0.12)", color: "#f87171" }}>
        P1
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ backgroundColor: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
        P2
      </span>
    );
  }
  if (severity === "ok") {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ade80" }}>
        P3
      </span>
    );
  }
  return <span className="text-[10px]" style={{ color: "var(--muted)" }}>—</span>;
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)    return "just now";
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

interface Props {
  agentType?: string;
  refreshTrigger?: number;
}

export default function ActionTrackerTable({ agentType, refreshTrigger }: Props) {
  const [rows, setRows] = useState<TrackedAction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = agentType
        ? `/api/agent/actions?agent_type=${agentType}`
        : "/api/agent/actions";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as TrackedAction[];
        setRows(data);
      }
    } catch {
      // keep stale on network error
    } finally {
      setLoading(false);
    }
  }, [agentType]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, refreshTrigger]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
          Action Log
        </p>
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>
          DB source of truth · refreshes on approval
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6" style={{ color: "var(--muted)" }}>
          <Loader2 size={13} className="animate-spin" />
          <span className="text-xs">Loading action log…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border py-8 flex items-center justify-center"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface2)" }}>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            No actions recorded yet — approve a recommendation above.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface2)" }}>
                  {["Station", "Recommendation", "Priority", "Status", "System Actions Executed", "Updated"].map((h) => (
                    <th key={h}
                      className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : undefined,
                    }}>
                    <td className="py-2.5 px-3 font-medium whitespace-nowrap" style={{ color: "var(--text)" }}>
                      {row.station ?? "—"}
                    </td>
                    <td className="py-2.5 px-3" style={{ color: "var(--text)", maxWidth: 240 }}>
                      <p className="text-xs leading-snug" style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {row.recommendation}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <PriorityBadge severity={row.severity} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-2.5 px-3">
                      {row.actions_taken.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {row.actions_taken.map((a, idx) => (
                            <span key={idx} className="text-[11px] flex items-start gap-1">
                              <CheckCircle2 size={10} className="shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
                              <span style={{ color: "var(--text)" }}>{a}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {timeAgo(row.completed_at ?? row.approved_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
