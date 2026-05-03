"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDemoMode } from "@/lib/demo-context";
import { mockEscalations } from "@/lib/mock-data";
import type { Escalation } from "@/lib/types";
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

export default function EscalationCenter() {
  const { isDemo } = useDemoMode();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);

  function handleExport() {
    downloadCsv("escalations", ["Time", "Issue", "Severity", "Sent To", "Status"],
      escalations.map((e) => [formatTime(e.triggered_at), e.issue_detail, e.severity, e.assigned_to, e.status])
    );
  }

  useEffect(() => {
    if (isDemo) {
      setEscalations(mockEscalations);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    supabase
      .from("escalations")
      .select("id, triggered_at, issue_detail, severity, assigned_to, status")
      .gte("triggered_at", todayStart.toISOString())
      .order("triggered_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setEscalations((data as Escalation[]) ?? []);
        setLoading(false);
      });
  }, [isDemo]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>Escalations & Notifications</h3>
        {escalations.length > 0 && (
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}>
            <Download size={11} /> Export CSV
          </button>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        {loading ? (
          <div className="px-5 py-8 text-center text-xs animate-pulse" style={{ color: "var(--muted)" }}>
            Loading escalations…
          </div>
        ) : escalations.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>No escalations today</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              The AI engineer will flag issues here as they arise.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ backgroundColor: "var(--surface2)", borderColor: "var(--border)" }}>
                {["Time", "Issue", "Severity", "Sent To", "Status"].map((h) => (
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
              {escalations.map((e, i) => (
                <tr
                  key={e.id}
                  className={`transition-colors hover:bg-[var(--surface2)] ${
                    i < escalations.length - 1 ? "border-b" : ""
                  }`}
                  style={i < escalations.length - 1 ? { borderColor: "var(--border)" } : {}}
                >
                  <td className="pl-5 pr-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {formatTime(e.triggered_at)}
                    <span className="block" style={{ color: "var(--subtle)" }}>{timeAgo(e.triggered_at)}</span>
                  </td>

                  <td className="px-4 py-3 text-xs max-w-xs" style={{ color: "var(--text)" }}>
                    {e.issue_detail}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex text-xs font-semibold border px-2 py-0.5 rounded-full ${
                        e.severity === "critical"
                          ? "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20"
                          : "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20"
                      }`}
                    >
                      {e.severity === "critical" ? "Critical" : "Warning"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {e.assigned_to}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        e.status === "notified" ? "text-[#4ade80]" : "text-[#fbbf24]"
                      }`}
                    >
                      {e.status === "notified" ? "Notified ✓" : "Pending"}
                    </span>
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
