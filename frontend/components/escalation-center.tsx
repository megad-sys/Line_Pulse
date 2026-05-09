"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, CheckCheck, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/export-csv";
import type { UnifiedAlert } from "@/app/api/agent/alerts/route";

type ActionStatus = "open" | "in_progress" | "notify_team" | "resolved" | "closed";

const ACTION_OPTIONS: { value: ActionStatus; label: string }[] = [
  { value: "open",        label: "Open"         },
  { value: "in_progress", label: "In Progress"  },
  { value: "notify_team", label: "Notify Team"  },
  { value: "resolved",    label: "Resolved"     },
  { value: "closed",      label: "Close issue"  },
];

const SOURCE_LABEL: Record<string, string> = {
  watchdog:   "Watchdog",
  bottleneck: "Bottleneck",
  quality:    "Quality",
  planning:   "Planning",
  shift:      "Shift",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function actionColor(status: ActionStatus): string {
  switch (status) {
    case "resolved":    return "#4ade80";
    case "closed":      return "var(--subtle)";
    case "in_progress": return "#60a5fa";
    case "notify_team": return "#fbbf24";
    default:            return "var(--muted)";
  }
}

export default function EscalationCenter() {
  const [alerts, setAlerts]           = useState<UnifiedAlert[]>([]);
  const [loading, setLoading]         = useState(true);
  const [resolving, setResolving]     = useState<string | null>(null);
  const [actions, setActions]         = useState<Record<string, ActionStatus>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/agent/alerts");
      if (res.ok) setAlerts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(alert: UnifiedAlert, status: ActionStatus) {
    setActions((prev) => ({ ...prev, [alert.id]: status }));

    if (status === "resolved" && alert.is_watchdog && alert.agent_alert_id) {
      setResolving(alert.id);
      try {
        await apiFetch(`/api/agent/alerts/${alert.agent_alert_id}/resolve`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved_by: "dashboard" }),
        });
      } finally {
        setResolving(null);
      }
    }

    if (status === "closed") {
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      }, 600);
    }
  }

  function handleExport() {
    downloadCsv(
      "alerts",
      ["Time", "Source", "Issue", "Severity", "Action"],
      alerts.map((a) => [
        formatTime(a.detected_at),
        SOURCE_LABEL[a.source] ?? a.source,
        a.issue,
        a.severity,
        actions[a.id] ?? "open",
      ])
    );
  }

  const visible = alerts.filter((a) => (actions[a.id] ?? "open") !== "closed");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>Alerts</h3>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
            >
              <Download size={11} /> Export
            </button>
          )}
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-8 animate-pulse" style={{ color: "var(--muted)" }}>
            <Loader2 size={13} className="animate-spin" />
            <span className="text-xs">Loading alerts…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>No open alerts</p>
            <p className="text-xs mt-1" style={{ color: "var(--subtle)" }}>
              Run Analysis to generate agent recommendations, or run the watchdog to detect stalls.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ backgroundColor: "var(--surface2)", borderColor: "var(--border)" }}>
                {["Time", "Source", "Issue", "Severity", "Action"].map((h) => (
                  <th key={h}
                    className="text-left text-xs font-medium px-4 py-2.5 uppercase tracking-wide first:pl-5"
                    style={{ color: "var(--muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((a, i) => {
                const currentAction = actions[a.id] ?? "open";
                return (
                  <tr key={a.id}
                    className={`transition-colors hover:bg-[var(--surface2)] ${i < visible.length - 1 ? "border-b" : ""}`}
                    style={i < visible.length - 1 ? { borderColor: "var(--border)" } : {}}>

                    {/* Time */}
                    <td className="pl-5 pr-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {formatTime(a.detected_at)}
                      <span className="block" style={{ color: "var(--subtle)" }}>{timeAgo(a.detected_at)}</span>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{
                          color: a.source === "watchdog" ? "#fbbf24" : "#60a5fa",
                          backgroundColor: a.source === "watchdog" ? "rgba(251,191,36,0.1)" : "rgba(96,165,250,0.1)",
                        }}>
                        {SOURCE_LABEL[a.source] ?? a.source}
                      </span>
                    </td>

                    {/* Issue */}
                    <td className="px-4 py-3 text-xs max-w-xs leading-relaxed" style={{ color: "var(--text)" }}>
                      {a.issue}
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-semibold border px-2 py-0.5 rounded-full ${
                        a.severity === "critical"
                          ? "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20"
                          : a.severity === "warning"
                          ? "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20"
                          : "text-[#60a5fa] bg-[#60a5fa]/10 border-[#60a5fa]/20"
                      }`}>
                        {a.severity === "critical" ? "Critical" : a.severity === "warning" ? "Warning" : "Info"}
                      </span>
                    </td>

                    {/* Action dropdown */}
                    <td className="px-4 py-3">
                      {currentAction === "resolved" && !resolving ? (
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#4ade80" }}>
                          <CheckCheck size={11} /> Resolved
                        </span>
                      ) : (
                        <div className="relative">
                          {resolving === a.id && (
                            <Loader2 size={11} className="animate-spin absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
                          )}
                          <select
                            value={currentAction}
                            onChange={(e) => handleAction(a, e.target.value as ActionStatus)}
                            disabled={resolving === a.id}
                            className="appearance-none text-xs pl-2 pr-6 py-1 rounded border cursor-pointer transition-colors disabled:opacity-40 outline-none"
                            style={{
                              backgroundColor: "var(--surface2)",
                              borderColor: "var(--border)",
                              color: actionColor(currentAction),
                            }}
                          >
                            {ACTION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}
                                style={{ backgroundColor: "var(--surface)", color: "var(--text)" }}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
