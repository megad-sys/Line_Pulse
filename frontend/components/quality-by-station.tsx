"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, AlertTriangle, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useDemoMode } from "@/lib/demo-context";
import { downloadCsv } from "@/lib/export-csv";
import type { QualityStationRow } from "@/app/api/shopfloor/metrics/route";

const DEMO: QualityStationRow[] = [
  { station_name: "Visual Inspection", units_processed: 30, defect_count: 8, defect_rate_pct: 26.7, rework_count: 5, rework_rate_pct: 16.7, scrap_count: 2 },
  { station_name: "Soldering",         units_processed: 58, defect_count: 4, defect_rate_pct: 6.9,  rework_count: 3, rework_rate_pct: 5.2,  scrap_count: 1 },
  { station_name: "SMT Assembly",      units_processed: 60, defect_count: 3, defect_rate_pct: 5.0,  rework_count: 2, rework_rate_pct: 3.3,  scrap_count: 0 },
  { station_name: "Functional Test",   units_processed: 45, defect_count: 2, defect_rate_pct: 4.4,  rework_count: 1, rework_rate_pct: 2.2,  scrap_count: 0 },
  { station_name: "Packaging",         units_processed: 45, defect_count: 0, defect_rate_pct: 0,    rework_count: 0, rework_rate_pct: 0,    scrap_count: 0 },
];

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Num({ value, color }: { value: number; color: string }) {
  return value > 0
    ? <span className="font-mono text-sm font-semibold" style={{ color }}>{value}</span>
    : <span className="font-mono text-sm" style={{ color: "var(--border)" }}>—</span>;
}

function Skeleton() {
  return (
    <div className="rounded-xl border overflow-hidden animate-pulse" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="h-4 w-48 rounded" style={{ backgroundColor: "var(--border)" }} />
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-center gap-6">
            <div className="h-3 w-32 rounded" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-3 w-8 rounded" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-3 w-8 rounded" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-3 w-8 rounded" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-3 w-10 rounded" style={{ backgroundColor: "var(--border)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QualityByStation() {
  const { isDemo } = useDemoMode();
  const [rows, setRows] = useState<QualityStationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDemoData, setIsDemoData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    if (isDemo) {
      setRows(DEMO); setIsDemoData(true); setLoading(false);
      setLastUpdated(new Date()); setRefreshing(false);
      return;
    }
    try {
      const res = await apiFetch("/api/shopfloor/metrics");
      if (res.ok) {
        const data = await res.json();
        if (data.hasData && data.qualityByStation?.length) {
          setRows(data.qualityByStation);
          setIsDemoData(false);
        } else {
          setRows(DEMO); setIsDemoData(true);
        }
        setLastUpdated(new Date());
      }
    } catch {
      setRows(DEMO); setIsDemoData(true); setLastUpdated(new Date());
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchData();
    const t = setInterval(() => fetchData(), 60_000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (loading) return <Skeleton />;

  const worstStation = rows[0];

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Quality Analysis by Station</h2>
          {isDemoData && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20">
              Demo data
            </span>
          )}
          {lastUpdated && (
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>Updated {fmtTime(lastUpdated)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}>
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => downloadCsv("quality-by-station",
              ["Station", "Units Processed", "Defects", "Defect Rate %", "Rework", "Rework Rate %", "Scrap"],
              rows.map((r) => [r.station_name, r.units_processed, r.defect_count, r.defect_rate_pct, r.rework_count, r.rework_rate_pct, r.scrap_count])
            )}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
            style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}>
            <Download size={11} /> Export CSV
          </button>
        </div>
      </div>

      {/* Worst station callout */}
      {worstStation && worstStation.defect_count > 0 && (
        <div className="px-5 py-3 border-b flex items-center gap-2"
          style={{ backgroundColor: "rgba(248,113,113,0.05)", borderColor: "var(--border)" }}>
          <AlertTriangle size={13} style={{ color: "#f87171" }} />
          <span className="text-xs" style={{ color: "var(--text)" }}>
            Highest defects:&nbsp;
            <span className="font-semibold" style={{ color: "#f87171" }}>{worstStation.station_name}</span>
            &nbsp;—&nbsp;{worstStation.defect_count} defects from {worstStation.units_processed} units processed
          </span>
        </div>
      )}

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ backgroundColor: "var(--surface2)", borderColor: "var(--border)" }}>
            {[
              { label: "Station",  style: "pl-5 pr-4" },
              { label: "Defects",  style: "px-4" },
              { label: "Rework",   style: "px-4" },
              { label: "Scrap",    style: "px-4" },
              { label: "Units",    style: "px-4" },
            ].map(({ label, style }) => (
              <th key={label} className={`text-left text-xs font-medium py-2.5 uppercase tracking-wide ${style}`}
                style={{ color: "var(--muted)" }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isWorst = i === 0 && row.defect_count > 0;
            return (
              <tr key={row.station_name}
                className={`transition-colors hover:bg-[var(--surface2)] ${i < rows.length - 1 ? "border-b" : ""}`}
                style={i < rows.length - 1 ? { borderColor: "var(--border)" } : {}}>
                <td className="pl-5 pr-4 py-3 font-medium whitespace-nowrap" style={{ color: "var(--text)" }}>
                  <div className="flex items-center gap-2">
                    {row.station_name}
                    {isWorst && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.12)" }}>
                        WORST
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3"><Num value={row.defect_count}  color="#fbbf24" /></td>
                <td className="px-4 py-3"><Num value={row.rework_count}  color="#fb923c" /></td>
                <td className="px-4 py-3"><Num value={row.scrap_count}   color="#f87171" /></td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--muted)" }}>
                  {row.units_processed > 0 ? row.units_processed : <span style={{ color: "var(--border)" }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
