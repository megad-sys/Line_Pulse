"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { useDemoMode } from "@/lib/demo-context";
import { mockStationStatus } from "@/lib/mock-data";
import type { StationStatusResponse, StationRow } from "@/app/api/dashboard/station-status/route";
import { apiFetch } from "@/lib/api";

type StationStatus = "WIP" | "Released" | "Rework" | "On Hold";

function deriveStatus(s: StationRow): StationStatus {
  if (s.rework_parts > 0)                          return "Rework";
  if (s.parts_here > 0)                            return "WIP";
  if (s.parts_here === 0 && s.completed_today > 0) return "Released";
  return "On Hold";
}

const STATUS_STYLES: Record<StationStatus, string> = {
  "WIP":      "text-[#60a5fa] bg-[#60a5fa]/10 border-[#60a5fa]/20",
  "Released": "text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20",
  "Rework":   "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20",
  "On Hold":  "text-[#7a7870] bg-[#2e2e2b] border-[#2e2e2b]",
};

function vsTarget(avg: number | null, target: number) {
  if (avg === null) return { label: "—", className: "text-[#7a7870]", isBottleneck: false };
  const ratio = avg / target;
  if (ratio <= 1)   return { label: `✓ ${avg}m`, className: "text-[#4ade80] font-semibold", isBottleneck: false };
  if (ratio <= 1.2) return { label: `~ ${avg}m`, className: "text-[#fbbf24] font-semibold", isBottleneck: false };
  return              { label: `⚠ ${avg}m`,  className: "text-[#f87171] font-semibold",  isBottleneck: true  };
}

function MiniBar({ row }: { row: StationRow }) {
  const total = row.completed_today + row.parts_here + row.rework_parts;
  const pct   = total > 0 ? Math.round((row.completed_today / total) * 100) : 0;
  const status = deriveStatus(row);

  const fillColor =
    status === "Released" ? "bg-[#4ade80]" :
    status === "Rework"   ? "bg-[#fbbf24]" :
    status === "On Hold"  ? "bg-[#2e2e2b]"  :
    "bg-[#60a5fa]";

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#2e2e2b" }}>
        <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right shrink-0" style={{ color: "#7a7870" }}>{pct}%</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rounded-xl border overflow-hidden animate-pulse" style={{ backgroundColor: "#1a1916", borderColor: "#2e2e2b" }}>
      <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: "#2e2e2b" }}>
        <div className="h-4 w-40 rounded" style={{ backgroundColor: "#2e2e2b" }} />
        <div className="h-4 w-4 rounded" style={{ backgroundColor: "#2e2e2b" }} />
      </div>
      <div className="divide-y" style={{ borderColor: "#2e2e2b" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="px-5 py-3 flex gap-6">
            {[28, 16, 10, 24, 12, 20].map((w, j) => (
              <div key={j} className={`h-3 w-${w} rounded`} style={{ backgroundColor: "#2e2e2b" }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StationStatusTable() {
  const { isDemo } = useDemoMode();
  const [data, setData]             = useState<StationStatusResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [selectedLineId, setSelectedLineId] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (isDemo) {
      setData(mockStationStatus as unknown as StationStatusResponse);
      setSelectedLineId("mock-line-a");
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch("/api/dashboard/station-status");
      if (res.ok) {
        const json: StationStatusResponse = await res.json();
        setData(json);
        setSelectedLineId((prev) => prev || json.lines[0]?.line_id || "");
      }
    } catch { /* keep stale data */ } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <Skeleton />;
  if (!data || data.lines.length === 0) return null;

  const activeLine = data.lines.find((l) => l.line_id === selectedLineId) ?? data.lines[0];

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#1a1916", borderColor: "#2e2e2b" }}>

      {/* Header */}
      <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "#2e2e2b" }}>
        <div className="flex items-center gap-3">
          {data.lines.length > 1 ? (
            <div className="relative flex items-center">
              <select
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="appearance-none text-sm font-semibold pr-5 outline-none cursor-pointer"
                style={{ color: "#f0ede8", background: "transparent" }}
              >
                {data.lines.map((l) => (
                  <option key={l.line_id} value={l.line_id}>{l.line_name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-0 pointer-events-none" style={{ color: "#7a7870" }} />
            </div>
          ) : (
            <h2 className="text-sm font-semibold" style={{ color: "#f0ede8" }}>{activeLine.line_name}</h2>
          )}

          {data.isDemo && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20">
              Demo data
            </span>
          )}
        </div>

        <span className="text-xs font-mono" style={{ color: "#7a7870" }}>Station Status</span>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ backgroundColor: "#222220", borderColor: "#2e2e2b" }}>
            {["Station", "Status", "Parts Here", "Progress", "Avg Cycle", "vs Target"].map((h) => (
              <th
                key={h}
                className="text-left text-xs font-medium px-4 py-2.5 uppercase tracking-wide first:pl-5"
                style={{ color: "#7a7870" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {activeLine.stations.map((station, i) => {
            const status = deriveStatus(station);
            const target = vsTarget(station.avg_cycle_mins, station.target_mins);

            return (
              <tr
                key={station.station_name}
                className={`transition-colors hover:bg-[#222220] ${
                  i < activeLine.stations.length - 1 ? "border-b" : ""
                }`}
                style={i < activeLine.stations.length - 1 ? { borderColor: "#2e2e2b" } : {}}
              >
                <td className="pl-5 pr-4 py-3 font-medium whitespace-nowrap" style={{ color: "#f0ede8" }}>
                  {station.station_name}
                </td>

                <td className="px-4 py-3">
                  <span className={`inline-flex text-xs font-semibold border px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {station.parts_here > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 text-xs font-bold rounded-full text-[#60a5fa] bg-[#60a5fa]/10">
                      {station.parts_here}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "#2e2e2b" }}>—</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <MiniBar row={station} />
                </td>

                <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: "#7a7870" }}>
                  {station.avg_cycle_mins !== null
                    ? `${station.avg_cycle_mins}m`
                    : <span style={{ color: "#2e2e2b" }}>—</span>}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs whitespace-nowrap ${target.className}`}>{target.label}</span>
                    {target.isBottleneck && (
                      <span className="text-xs font-bold text-[#f87171] bg-[#f87171]/10 border border-[#f87171]/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                        BOTTLENECK
                      </span>
                    )}
                    {station.avg_cycle_mins === null && (
                      <span className="text-xs whitespace-nowrap" style={{ color: "#4a4a45" }}>
                        target {station.target_mins}m
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t" style={{ backgroundColor: "#222220", borderColor: "#2e2e2b" }}>
            <td className="pl-5 pr-4 py-2.5 text-xs font-semibold" style={{ color: "#7a7870" }}>Total in progress</td>
            <td />
            <td className="px-4 py-2.5 text-xs font-bold" style={{ color: "#f0ede8" }}>
              {activeLine.total_wip} {activeLine.total_wip === 1 ? "part" : "parts"}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
