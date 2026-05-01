"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { useDemoMode } from "@/lib/demo-context";
import { mockStationStatus } from "@/lib/mock-data";
import type { StationStatusResponse, StationRow } from "@/app/api/dashboard/station-status/route";

// ── Status logic ───────────────────────────────────────────────

type StationStatus = "WIP" | "Released" | "Rework" | "On Hold";

function deriveStatus(s: StationRow): StationStatus {
  if (s.rework_parts > 0)                                    return "Rework";
  if (s.parts_here > 0)                                      return "WIP";
  if (s.parts_here === 0 && s.completed_today > 0)           return "Released";
  return "On Hold";
}

const STATUS_STYLES: Record<StationStatus, string> = {
  "WIP":      "text-blue-700 bg-blue-50 border-blue-200",
  "Released": "text-green-700 bg-green-50 border-green-200",
  "Rework":   "text-amber-700 bg-amber-50 border-amber-200",
  "On Hold":  "text-gray-500 bg-gray-100 border-gray-200",
};

// ── Cycle vs target ────────────────────────────────────────────

function vsTarget(avg: number | null, target: number) {
  if (avg === null) return { label: "—", className: "text-gray-300", isBottleneck: false };
  const ratio = avg / target;
  if (ratio <= 1)   return { label: `✓ ${avg}m`, className: "text-green-600 font-semibold", isBottleneck: false };
  if (ratio <= 1.2) return { label: `~ ${avg}m`, className: "text-amber-500 font-semibold", isBottleneck: false };
  return              { label: `⚠ ${avg}m`,  className: "text-red-600 font-semibold",   isBottleneck: true  };
}

// ── Mini progress bar ──────────────────────────────────────────

function MiniBar({ row }: { row: StationRow }) {
  const total = row.completed_today + row.parts_here + row.rework_parts;
  const pct   = total > 0 ? Math.round((row.completed_today / total) * 100) : 0;
  const status = deriveStatus(row);

  const fillColor =
    status === "Released" ? "bg-green-500" :
    status === "Rework"   ? "bg-amber-400" :
    status === "On Hold"  ? "bg-gray-200"  :
    "bg-blue-500";

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${fillColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 font-mono w-8 text-right shrink-0">{pct}%</span>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="h-4 w-40 bg-gray-100 rounded" />
        <div className="h-4 w-4 bg-gray-100 rounded" />
      </div>
      <div className="divide-y divide-gray-50">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="px-5 py-3 flex gap-6">
            <div className="h-3 w-28 bg-gray-100 rounded" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
            <div className="h-3 w-10 bg-gray-100 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
            <div className="h-3 w-12 bg-gray-100 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function StationStatusTable() {
  const { isDemo } = useDemoMode();
  const [data, setData]               = useState<StationStatusResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [selectedLineId, setSelectedLineId] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (isDemo) {
      setData(mockStationStatus as unknown as StationStatusResponse);
      setSelectedLineId("mock-line-a");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/dashboard/station-status");
      if (res.ok) {
        const json: StationStatusResponse = await res.json();
        setData(json);
        setSelectedLineId((prev) => prev || json.lines[0]?.line_id || "");
      }
    } catch {
      // keep stale data on network errors
    } finally {
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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">

          {/* Line dropdown */}
          {data.lines.length > 1 ? (
            <div className="relative flex items-center">
              <select
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="appearance-none text-sm font-semibold text-gray-900 bg-transparent pr-5 outline-none cursor-pointer"
              >
                {data.lines.map((l) => (
                  <option key={l.line_id} value={l.line_id}>{l.line_name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-0 text-gray-400 pointer-events-none" />
            </div>
          ) : (
            <h2 className="text-sm font-semibold text-gray-900">{activeLine.line_name}</h2>
          )}

          {data.isDemo && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Demo data
            </span>
          )}
        </div>

        <span className="text-xs text-gray-400 font-mono">Station Status</span>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50 bg-gray-50/50">
            {["Station", "Status", "Parts Here", "Progress", "Avg Cycle", "vs Target"].map((h) => (
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
          {activeLine.stations.map((station, i) => {
            const status  = deriveStatus(station);
            const target  = vsTarget(station.avg_cycle_mins, station.target_mins);

            return (
              <tr
                key={station.station_name}
                className={`transition-colors hover:bg-gray-50/50 ${
                  i < activeLine.stations.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                {/* Station */}
                <td className="pl-5 pr-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                  {station.station_name}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span className={`inline-flex text-xs font-semibold border px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                </td>

                {/* Parts here */}
                <td className="px-4 py-3">
                  {station.parts_here > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
                      {station.parts_here}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>

                {/* Progress bar */}
                <td className="px-4 py-3">
                  <MiniBar row={station} />
                </td>

                {/* Avg cycle */}
                <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                  {station.avg_cycle_mins !== null ? `${station.avg_cycle_mins}m` : <span className="text-gray-300">—</span>}
                </td>

                {/* vs Target */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs whitespace-nowrap ${target.className}`}>{target.label}</span>
                    {target.isBottleneck && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                        BOTTLENECK
                      </span>
                    )}
                    {station.avg_cycle_mins === null && (
                      <span className="text-xs text-gray-300 whitespace-nowrap">target {station.target_mins}m</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* Footer */}
        <tfoot>
          <tr className="border-t border-gray-100 bg-gray-50/50">
            <td className="pl-5 pr-4 py-2.5 text-xs font-semibold text-gray-500">Total in progress</td>
            <td />
            <td className="px-4 py-2.5 text-xs font-bold text-gray-700">
              {activeLine.total_wip} {activeLine.total_wip === 1 ? "part" : "parts"}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
