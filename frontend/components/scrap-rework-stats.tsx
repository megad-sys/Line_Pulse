"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, RefreshCw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { useDemoMode } from "@/lib/demo-context";
import { downloadCsv } from "@/lib/export-csv";
import type { QualityStationRow } from "@/app/api/shopfloor/metrics/route";
import type { ManufacturingKPIs } from "@/lib/types";

const DEMO_ROWS: QualityStationRow[] = [
  { station_name: "Visual Inspection", units_processed: 30, defect_count: 8, defect_rate_pct: 26.7, rework_count: 5, rework_rate_pct: 16.7, scrap_count: 2 },
  { station_name: "Soldering",         units_processed: 58, defect_count: 4, defect_rate_pct: 6.9,  rework_count: 3, rework_rate_pct: 5.2,  scrap_count: 1 },
  { station_name: "SMT Assembly",      units_processed: 60, defect_count: 3, defect_rate_pct: 5.0,  rework_count: 2, rework_rate_pct: 3.3,  scrap_count: 0 },
  { station_name: "Functional Test",   units_processed: 45, defect_count: 2, defect_rate_pct: 4.4,  rework_count: 1, rework_rate_pct: 2.2,  scrap_count: 0 },
  { station_name: "Packaging",         units_processed: 45, defect_count: 0, defect_rate_pct: 0,    rework_count: 0, rework_rate_pct: 0,    scrap_count: 0 },
];

const DEMO_DPMO       = 8200;
const DEMO_DEFECT_PCT = 6.9;

type CardColor = "green" | "amber" | "red" | "blue";
const COLOR: Record<CardColor, string> = {
  green: "#4ade80", amber: "#fbbf24", red: "#f87171", blue: "#60a5fa",
};

function dpmoColor(v: number): CardColor  { return v < 1000 ? "green" : v < 10000 ? "amber" : "red"; }
function defectColor(v: number): CardColor { return v < 5 ? "green" : v <= 10 ? "amber" : "red"; }
function scrapColor(v: number): CardColor  { return v === 0 ? "green" : v <= 3 ? "amber" : "red"; }
function reworkColor(v: number): CardColor { return v === 0 ? "green" : v <= 5 ? "amber" : "red"; }

function KpiCard({ title, value, sub, color }: { title: string; value: string; sub: string; color: CardColor }) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>{title}</p>
      <p className="text-2xl font-extrabold mb-1 leading-none font-mono" style={{ color: COLOR[color] }}>{value}</p>
      <p className="text-xs" style={{ color: "var(--muted)" }}>{sub}</p>
    </div>
  );
}

function abbrev(name: string) {
  if (name.length <= 8) return name;
  const w = name.split(" ");
  return w.length >= 2 && w[0].length + w[1].length < 11 ? `${w[0]} ${w[1]}` : w[0];
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="h-3 w-24 rounded mb-3" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-7 w-16 rounded mb-2" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-3 w-28 rounded" style={{ backgroundColor: "var(--border)" }} />
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-5 animate-pulse" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="h-52 rounded" style={{ backgroundColor: "var(--border)" }} />
      </div>
    </div>
  );
}

export default function ScrapReworkStats() {
  const { isDemo } = useDemoMode();
  const [rows, setRows] = useState<QualityStationRow[]>([]);
  const [dpmo, setDpmo] = useState(0);
  const [defectFlagRate, setDefectFlagRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDemoData, setIsDemoData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    if (isDemo) {
      setRows(DEMO_ROWS);
      setDpmo(DEMO_DPMO);
      setDefectFlagRate(DEMO_DEFECT_PCT);
      setIsDemoData(true);
      setLoading(false);
      setLastUpdated(new Date());
      setRefreshing(false);
      return;
    }
    try {
      const res = await apiFetch("/api/shopfloor/metrics");
      if (res.ok) {
        const data = await res.json();
        if (data.hasData) {
          if (data.qualityByStation?.length) setRows(data.qualityByStation);
          else setRows(DEMO_ROWS);
          if (data.mfgKpis) {
            const k = data.mfgKpis as ManufacturingKPIs;
            setDpmo(k.dpmo);
            setDefectFlagRate(k.defectFlagRate);
          }
          setIsDemoData(!data.qualityByStation?.length);
        } else {
          setRows(DEMO_ROWS); setDpmo(DEMO_DPMO); setDefectFlagRate(DEMO_DEFECT_PCT); setIsDemoData(true);
        }
        setLastUpdated(new Date());
      }
    } catch {
      setRows(DEMO_ROWS); setDpmo(DEMO_DPMO); setDefectFlagRate(DEMO_DEFECT_PCT);
      setIsDemoData(true); setLastUpdated(new Date());
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

  const totalScrap  = rows.reduce((s, r) => s + r.scrap_count, 0);
  const totalRework = rows.reduce((s, r) => s + r.rework_count, 0);

  const chartData = rows.map((r) => ({
    name: abbrev(r.station_name),
    Rework: r.rework_count,
    Scrap: r.scrap_count,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard title="DPMO"             value={dpmo.toLocaleString()}   sub={dpmo < 1000 ? "World class" : dpmo < 10000 ? "Good" : "Needs improvement"} color={dpmoColor(dpmo)} />
        <KpiCard title="Defect Flag Rate" value={`${defectFlagRate}%`}   sub="Parts flagged with a defect scan"  color={defectColor(defectFlagRate)} />
        <KpiCard title="Total Scrap"      value={String(totalScrap)}     sub="Units scrapped this shift"         color={scrapColor(totalScrap)} />
        <KpiCard title="Total Rework"     value={String(totalRework)}    sub="Units sent back for rework"        color={reworkColor(totalRework)} />
      </div>

      {/* Bar chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>Scrap &amp; Rework by Station</h3>
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
              onClick={() => downloadCsv("scrap-rework",
                ["Station", "Scrap", "Rework", "Units Processed"],
                rows.map((r) => [r.station_name, r.scrap_count, r.rework_count, r.units_processed])
              )}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
              style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}>
              <Download size={11} /> Export CSV
            </button>
          </div>
        </div>

        <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a3a35" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  fontSize: 12, borderRadius: 8,
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                cursor={{ fill: "var(--surface2)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, color: "var(--muted)" }} iconType="circle" iconSize={8} />
              <Bar dataKey="Rework" fill="#fb923c" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Scrap"  fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
