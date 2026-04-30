"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type StatusRow = {
  label: string;
  dbStatus: string[];
  color: string;
  bgColor: string;
  now: number;
  today: number;
  thisWeek: number;
};

const STATUS_DEFS: Omit<StatusRow, "now" | "today" | "thisWeek">[] = [
  { label: "WIP",      dbStatus: ["wip"],       color: "text-blue-700",  bgColor: "bg-blue-50"  },
  { label: "Released", dbStatus: ["done"],      color: "text-green-700", bgColor: "bg-green-50" },
  { label: "Rework",   dbStatus: [],            color: "text-amber-700", bgColor: "bg-amber-50" },
  { label: "At QC",    dbStatus: [],            color: "text-amber-700", bgColor: "bg-amber-50" },
  { label: "Failed",   dbStatus: ["failed_qc"], color: "text-red-700",   bgColor: "bg-red-50"   },
  { label: "On Hold",  dbStatus: ["scrapped"],  color: "text-gray-600",  bgColor: "bg-gray-100" },
];

const MOCK_ROWS: StatusRow[] = [
  { ...STATUS_DEFS[0], now: 33, today: 8,  thisWeek: 61 },
  { ...STATUS_DEFS[1], now: 47, today: 47, thisWeek: 89 },
  { ...STATUS_DEFS[2], now: 4,  today: 4,  thisWeek: 9  },
  { ...STATUS_DEFS[3], now: 6,  today: 6,  thisWeek: 14 },
  { ...STATUS_DEFS[4], now: 2,  today: 2,  thisWeek: 5  },
  { ...STATUS_DEFS[5], now: 1,  today: 0,  thisWeek: 1  },
];

function Skeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="h-4 w-28 bg-gray-100 rounded" />
      </div>
      <div className="divide-y divide-gray-50">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="px-5 py-3 flex gap-8">
            <div className="h-3 w-20 bg-gray-100 rounded" />
            <div className="h-3 w-10 bg-gray-100 rounded ml-auto" />
            <div className="h-3 w-10 bg-gray-100 rounded" />
            <div className="h-3 w-10 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PartStatusTable() {
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [{ data: parts }, { data: scansToday }, { data: scansWeek }] = await Promise.all([
      supabase.from("parts").select("current_status"),
      supabase
        .from("scans")
        .select("status, part_id")
        .gte("scanned_at", todayStart.toISOString()),
      supabase
        .from("scans")
        .select("status, part_id")
        .gte("scanned_at", weekStart.toISOString()),
    ]);

    const totalParts = parts?.length ?? 0;

    if (totalParts === 0) {
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

    const failedTodayIds = new Set(
      (scansToday ?? []).filter((s) => s.status === "failed_qc").map((s) => s.part_id)
    );
    const releasedTodayIds = new Set(
      (scansToday ?? []).filter((s) => s.status === "completed").map((s) => s.part_id)
    );
    const failedWeekIds = new Set(
      (scansWeek ?? []).filter((s) => s.status === "failed_qc").map((s) => s.part_id)
    );
    const releasedWeekIds = new Set(
      (scansWeek ?? []).filter((s) => s.status === "completed").map((s) => s.part_id)
    );

    const built: StatusRow[] = STATUS_DEFS.map((def) => {
      const now = def.dbStatus.reduce((sum, s) => sum + (nowCounts[s] ?? 0), 0);

      let today = 0;
      let thisWeek = 0;

      if (def.label === "Failed") {
        today = failedTodayIds.size;
        thisWeek = failedWeekIds.size;
      } else if (def.label === "Released") {
        today = releasedTodayIds.size;
        thisWeek = releasedWeekIds.size;
      }

      return { ...def, now, today, thisWeek };
    });

    setRows(built);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <Skeleton />;

  const total = {
    now: rows.reduce((s, r) => s + r.now, 0),
    today: rows.reduce((s, r) => s + r.today, 0),
    thisWeek: rows.reduce((s, r) => s + r.thisWeek, 0),
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Part Status</h2>
        {isDemo && (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Demo data
          </span>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50 bg-gray-50/50">
            {["Status", "Now", "Today", "This Week"].map((h) => (
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
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={`transition-colors hover:bg-gray-50/50 ${
                i < rows.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              <td className="pl-5 pr-4 py-3">
                <span className={`inline-flex text-xs font-semibold border border-gray-200 px-2 py-0.5 rounded-full ${row.color} ${row.bgColor}`}>
                  {row.label}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-bold text-gray-800">
                {row.now > 0 ? row.now : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {row.today > 0 ? row.today : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {row.thisWeek > 0 ? row.thisWeek : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t border-gray-100 bg-gray-50/50">
            <td className="pl-5 pr-4 py-2.5 text-xs font-semibold text-gray-500">Total</td>
            <td className="px-4 py-2.5 text-xs font-bold text-gray-700">{total.now}</td>
            <td className="px-4 py-2.5 text-xs font-bold text-gray-700">{total.today || "—"}</td>
            <td className="px-4 py-2.5 text-xs font-bold text-gray-700">{total.thisWeek || "—"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
