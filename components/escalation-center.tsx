"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDemoMode } from "@/lib/demo-context";
import { mockEscalations } from "@/lib/mock-data";
import type { Escalation } from "@/lib/types";

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
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Escalations & Notifications</h3>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-5 py-8 text-center text-xs text-gray-400 animate-pulse">
            Loading escalations…
          </div>
        ) : escalations.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium text-gray-500">No escalations today</p>
            <p className="text-xs text-gray-400 mt-1">
              The AI engineer will flag issues here as they arise.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                {["Time", "Issue", "Severity", "Sent To", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-gray-400 px-4 py-2.5 uppercase tracking-wide first:pl-5"
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
                  className={`transition-colors hover:bg-gray-50/40 ${
                    i < escalations.length - 1 ? "border-b border-gray-50" : ""
                  }`}
                >
                  <td className="pl-5 pr-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                    {formatTime(e.triggered_at)}
                    <span className="block text-gray-400">{timeAgo(e.triggered_at)}</span>
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-700 max-w-xs">
                    {e.issue_detail}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex text-xs font-semibold border px-2 py-0.5 rounded-full ${
                        e.severity === "critical"
                          ? "text-red-700 bg-red-50 border-red-200"
                          : "text-amber-700 bg-amber-50 border-amber-200"
                      }`}
                    >
                      {e.severity === "critical" ? "Critical" : "Warning"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {e.assigned_to}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        e.status === "notified"
                          ? "text-green-600"
                          : "text-amber-600"
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
