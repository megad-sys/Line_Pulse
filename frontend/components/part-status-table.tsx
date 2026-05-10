"use client";

import { useEffect, useState, useCallback } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDemoMode } from "@/lib/demo-context";
import { downloadCsv } from "@/lib/export-csv";
import { apiFetch } from "@/lib/api";

type StatusRow = {
  label: string;
  dbStatus: string[];
  pill: string;
  now: number;
  today: number;
  thisWeek: number;
};

const STATUS_DEFS: Omit<StatusRow, "now" | "today" | "thisWeek">[] = [
  { label: "WIP",      dbStatus: ["wip"],       pill: "text-[#60a5fa] bg-[#60a5fa]/10 border-[#60a5fa]/20"            },
  { label: "Released", dbStatus: ["done"],      pill: "text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20"            },
  { label: "Rework",   dbStatus: ["rework"],    pill: "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20"            },
  { label: "Scrap",    dbStatus: ["scrapped"],  pill: "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20"            },
  { label: "On Hold",  dbStatus: ["failed_qc"], pill: "text-[var(--muted)] bg-[var(--border)] border-[var(--border)]" },
];

const MOCK_ROWS: StatusRow[] = [
  { ...STATUS_DEFS[0], now: 33, today: 8,  thisWeek: 61 },
  { ...STATUS_DEFS[1], now: 47, today: 47, thisWeek: 89 },
  { ...STATUS_DEFS[2], now: 4,  today: 4,  thisWeek: 9  },
  { ...STATUS_DEFS[3], now: 1,  today: 1,  thisWeek: 3  },
  { ...STATUS_DEFS[4], now: 2,  today: 0,  thisWeek: 2  },
];

function Skeleton() {
  return (
    <div className="rounded-xl border overflow-hidden animate-pulse" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="h-4 w-28 rounded" style={{ backgroundColor: "var(--border)" }} />
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="px-5 py-3 flex gap-8">
            <div className="h-3 w-20 rounded" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-3 w-10 rounded ml-auto" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-3 w-10 rounded" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-3 w-10 rounded" style={{ backgroundColor: "var(--border)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PartStatusTable() {
  const { isDemo: ctxDemo } = useDemoMode();
  const [rows, setRows]   = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo]   = useState(false);

  const fetchData = useCallback(async () => {
    if (ctxDemo) {
      setIsDemo(true);
      setRows(MOCK_ROWS);
      setLoading(false);
      return;
    }
    const supabase = createClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [{ data: parts }, { data: scansToday }, { data: scansWeek }] = await Promise.all([
      supabase.from("parts").select("current_status"),
      supabase.from("scans").select("status, part_id").gte("scanned_at", todayStart.toISOString()),
      supabase.from("scans").select("status, part_id").gte("scanned_at", weekStart.toISOString()),
    ]);

    const totalParts = parts?.length ?? 0;

    if (totalParts === 0) {
      // Try new tables via shopfloor metrics API
      const res = await apiFetch("/api/shopfloor/metrics");
      if (res.ok) {
        const data = await res.json();
        if (data.hasData && data.partStatus?.rows) {
          // Merge API counts with STATUS_DEFS to satisfy the StatusRow shape
          const apiRows = data.partStatus.rows as Array<{ label: string; now: number; today: number; thisWeek: number }>;
          const merged = STATUS_DEFS.map((def) => {
            const match = apiRows.find((r) => r.label === def.label);
            return { ...def, now: match?.now ?? 0, today: match?.today ?? 0, thisWeek: match?.thisWeek ?? 0 };
          });
          setIsDemo(false);
          setRows(merged);
          setLoading(false);
          return;
        }
      }
      setIsDemo(true);
      setRows(MOCK_ROWS);
      setLoading(false);
      return;
    }

    setIsDemo(false);

    const nowCounts: Record<string, number> = {};
    for (const p of parts ?? []) {
      nowCounts[p.current_status] = (nowCounts[p.current_status] ?? 0) + 1;
    }

    const failedTodayIds   = new Set((scansToday ?? []).filter((s) => s.status === "failed_qc").map((s) => s.part_id));
    const releasedTodayIds = new Set((scansToday ?? []).filter((s) => s.status === "completed").map((s) => s.part_id));
    const failedWeekIds    = new Set((scansWeek ?? []).filter((s) => s.status === "failed_qc").map((s) => s.part_id));
    const releasedWeekIds  = new Set((scansWeek ?? []).filter((s) => s.status === "completed").map((s) => s.part_id));

    const built: StatusRow[] = STATUS_DEFS.map((def) => {
      const now = def.dbStatus.reduce((sum, s) => sum + (nowCounts[s] ?? 0), 0);
      let today = 0, thisWeek = 0;
      if (def.label === "Failed")   { today = failedTodayIds.size;   thisWeek = failedWeekIds.size;   }
      if (def.label === "Released") { today = releasedTodayIds.size; thisWeek = releasedWeekIds.size; }
      return { ...def, now, today, thisWeek };
    });

    setRows(built);
    setLoading(false);
  }, [ctxDemo]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData, ctxDemo]);

  if (loading) return <Skeleton />;

  const total = {
    now:      rows.reduce((s, r) => s + r.now, 0),
    today:    rows.reduce((s, r) => s + r.today, 0),
    thisWeek: rows.reduce((s, r) => s + r.thisWeek, 0),
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Part Status</h2>
          {isDemo && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20">
              Demo data
            </span>
          )}
        </div>
        <button onClick={() => downloadCsv("part-status", ["Status", "Now", "Today", "This Week"],
          rows.map((r) => [r.label, r.now, r.today, r.thisWeek]))}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
          style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}>
          <Download size={11} /> Export CSV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ backgroundColor: "var(--surface2)", borderColor: "var(--border)" }}>
            {["Status", "Now", "Today", "This Week"].map((h) => (
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
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={`transition-colors hover:bg-[var(--surface2)] ${i < rows.length - 1 ? "border-b" : ""}`}
              style={i < rows.length - 1 ? { borderColor: "var(--border)" } : {}}
            >
              <td className="pl-5 pr-4 py-3">
                <span className={`inline-flex text-xs font-semibold border px-2 py-0.5 rounded-full ${row.pill}`}>
                  {row.label}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-bold" style={{ color: "var(--text)" }}>
                {row.now > 0 ? row.now : <span style={{ color: "var(--border)" }}>—</span>}
              </td>
              <td className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
                {row.today > 0 ? row.today : <span style={{ color: "var(--border)" }}>—</span>}
              </td>
              <td className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
                {row.thisWeek > 0 ? row.thisWeek : <span style={{ color: "var(--border)" }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t" style={{ backgroundColor: "var(--surface2)", borderColor: "var(--border)" }}>
            <td className="pl-5 pr-4 py-2.5 text-xs font-semibold" style={{ color: "var(--muted)" }}>Total</td>
            <td className="px-4 py-2.5 text-xs font-bold" style={{ color: "var(--text)" }}>{total.now}</td>
            <td className="px-4 py-2.5 text-xs font-bold" style={{ color: "var(--text)" }}>{total.today || "—"}</td>
            <td className="px-4 py-2.5 text-xs font-bold" style={{ color: "var(--text)" }}>{total.thisWeek || "—"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
