"use client";

import { useEffect, useState } from "react";
import { Download, CheckCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useDemoMode } from "@/lib/demo-context";
import { mockAgentAlerts } from "@/lib/mock-data";
import type { AgentAlert } from "@/lib/types";
import { downloadCsv } from "@/lib/export-csv";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatIssue(alert: AgentAlert): string {
  if (alert.alert_type === "stall") {
    const dur = alert.stall_duration_mins
      ? ` — ${Math.round(alert.stall_duration_mins)} min`
      : "";
    return `Bottleneck at ${alert.station_name}${dur}`;
  }
  return `Quality spike at ${alert.station_name}`;
}

export default function EscalationCenter() {
  const { isDemo } = useDemoMode();
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  async function handleResolve(id: string) {
    if (isDemo) {
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, resolved_at: new Date().toISOString(), resolved_by: "You" } : a));
      return;
    }
    setResolving(id);
    try {
      await apiFetch(`/api/agent/alerts/${id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved_by: "dashboard" }),
      });
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, resolved_at: new Date().toISOString(), resolved_by: "dashboard" } : a));
    } finally {
      setResolving(null);
    }
  }

  function handleExport() {
    downloadCsv(
      "agent-alerts",
      ["Time", "Issue", "Severity", "Status"],
      alerts.map((a) => [
        formatTime(a.detected_at),
        formatIssue(a),
        a.severity,
        a.resolved_at ? `Resolved by ${a.resolved_by ?? "unknown"}` : "Active",
      ])
    );
  }

  useEffect(() => {
    if (isDemo) {
      setAlerts(mockAgentAlerts);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    supabase
      .from("agent_alerts")
      .select("id, detected_at, alert_type, station_name, severity, stall_duration_mins, resolved_at, resolved_by")
      .order("detected_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setAlerts((data as AgentAlert[]) ?? []);
        setLoading(false);
      });
  }, [isDemo]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>Agent Alerts</h3>
        {alerts.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
          >
            <Download size={11} /> Export CSV
          </button>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        {loading ? (
          <div className="px-5 py-8 text-center text-xs animate-pulse" style={{ color: "var(--muted)" }}>
            Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>No alerts detected</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Agents will flag stalls and quality spikes here as they are detected.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ backgroundColor: "var(--surface2)", borderColor: "var(--border)" }}>
                {["Time", "Issue", "Severity", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium px-4 py-2.5 uppercase tracking-wide first:pl-5"
                    style={{ color: "var(--muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((a, i) => (
                <tr
                  key={a.id}
                  className={`transition-colors hover:bg-[var(--surface2)] ${i < alerts.length - 1 ? "border-b" : ""}`}
                  style={i < alerts.length - 1 ? { borderColor: "var(--border)" } : {}}
                >
                  <td className="pl-5 pr-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {formatTime(a.detected_at)}
                    <span className="block" style={{ color: "var(--subtle)" }}>{timeAgo(a.detected_at)}</span>
                  </td>

                  <td className="px-4 py-3 text-xs max-w-xs" style={{ color: "var(--text)" }}>
                    {formatIssue(a)}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs font-semibold border px-2 py-0.5 rounded-full ${
                      a.severity === "critical"
                        ? "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20"
                        : "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20"
                    }`}>
                      {a.severity === "critical" ? "Critical" : "Warning"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {a.resolved_at ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4ade80]">
                        <CheckCheck size={11} /> Resolved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResolve(a.id)}
                        disabled={resolving === a.id}
                        className="text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40"
                        style={{ color: "var(--muted)", borderColor: "var(--border)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
                      >
                        {resolving === a.id ? "…" : "Resolve"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
