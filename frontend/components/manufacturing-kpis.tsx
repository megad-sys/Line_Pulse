"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDemoMode } from "@/lib/demo-context";
import { mockMfgKpis } from "@/lib/mock-data";
import { apiFetch } from "@/lib/api";
import type { ManufacturingKPIs } from "@/lib/types";

type CardColor = "green" | "amber" | "red" | "blue";

const COLOR_STYLES: Record<CardColor, { num: string; bar: string }> = {
  green: { num: "text-[#4ade80]", bar: "bg-[#4ade80]" },
  amber: { num: "text-[#fbbf24]", bar: "bg-[#fbbf24]" },
  red:   { num: "text-[#f87171]", bar: "bg-[#f87171]" },
  blue:  { num: "text-[#60a5fa]", bar: "bg-[#60a5fa]" },
};

function MfgCard({
  title,
  value,
  sub,
  color,
  barPct,
  context,
}: {
  title: string;
  value: string;
  sub: string;
  color: CardColor;
  barPct?: number;
  context?: string;
}) {
  const s = COLOR_STYLES[color];
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>{title}</p>
      <p className={`text-2xl font-extrabold mb-1 leading-none ${s.num}`}>{value}</p>
      {context && (
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>{context}</p>
      )}
      {barPct !== undefined && (
        <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: "var(--border)" }}>
          <div
            className={`h-full rounded-full ${s.bar} transition-all`}
            style={{ width: `${Math.min(100, barPct)}%` }}
          />
        </div>
      )}
      <p className="text-xs" style={{ color: "var(--muted)" }}>{sub}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="h-3 w-24 rounded mb-3" style={{ backgroundColor: "var(--border)" }} />
          <div className="h-7 w-16 rounded mb-2" style={{ backgroundColor: "var(--border)" }} />
          <div className="h-1.5 rounded-full mb-2" style={{ backgroundColor: "var(--border)" }} />
          <div className="h-3 w-32 rounded" style={{ backgroundColor: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}

function oeeColor(v: number): CardColor  { return v >= 85 ? "green" : v >= 65 ? "amber" : "red"; }
function fpyColor(v: number): CardColor  { return v >= 95 ? "green" : v >= 85 ? "amber" : "red"; }
function scrapColor(v: number): CardColor { return v < 2 ? "green" : v <= 5 ? "amber" : "red"; }
function reworkColor(v: number): CardColor { return v < 5 ? "green" : v <= 10 ? "amber" : "red"; }
function dpmoContext(v: number): string   { return v < 1000 ? "World class" : v < 10000 ? "Good" : "Needs improvement"; }

async function fetchMfgKpis(): Promise<ManufacturingKPIs> {
  const supabase = createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const shiftElapsedHours = (Date.now() - todayStart.getTime()) / 3_600_000;

  const [{ data: parts }, { data: scans }] = await Promise.all([
    supabase.from("parts").select("id, current_status"),
    supabase
      .from("scans")
      .select("part_id, station_name, status, scanned_at, downtime_start, downtime_end")
      .gte("scanned_at", todayStart.toISOString()),
  ]);

  const allParts = parts ?? [];
  const allScans = scans ?? [];
  const total    = allParts.length;
  const released = allParts.filter((p) => p.current_status === "done").length;
  const scrapped = allParts.filter((p) => p.current_status === "scrapped").length;
  const failed   = allParts.filter((p) => p.current_status === "failed_qc").length;

  if (total === 0) {
    const res = await apiFetch("/api/shopfloor/metrics");
    if (res.ok) {
      const data = await res.json();
      if (data.hasData && data.mfgKpis) return data.mfgKpis as ManufacturingKPIs;
    }
    return mockMfgKpis;
  }

  const failedIds = new Set(allScans.filter((s) => s.status === "failed_qc").map((s) => s.part_id));
  const fpy = Math.round(((total - failedIds.size) / total) * 1000) / 10;

  const throughput = shiftElapsedHours > 0
    ? Math.round((released / shiftElapsedHours) * 10) / 10
    : 0;

  const partTimes: Record<string, { min: number; max: number }> = {};
  for (const s of allScans) {
    const t = new Date(s.scanned_at).getTime();
    if (!partTimes[s.part_id]) partTimes[s.part_id] = { min: t, max: t };
    else {
      partTimes[s.part_id].min = Math.min(partTimes[s.part_id].min, t);
      partTimes[s.part_id].max = Math.max(partTimes[s.part_id].max, t);
    }
  }
  const cycleMins = Object.values(partTimes).map(({ min, max }) => (max - min) / 60_000);
  const avgCycleTime = cycleMins.length > 0
    ? Math.round(cycleMins.reduce((a, b) => a + b, 0) / cycleMins.length)
    : 0;

  const quality = released / total;
  const targetRate = 80 / 8;
  const performance = shiftElapsedHours > 0
    ? Math.min(1, (released / shiftElapsedHours) / targetRate)
    : 0;
  const oee = Math.round(quality * performance * 100);

  const scrapRate  = Math.round((scrapped / total) * 1000) / 10;
  const reworkRate = Math.round((failed / total) * 1000) / 10;

  const stationCount = new Set(allScans.map((s) => s.station_name)).size || 1;
  const failedScans  = allScans.filter((s) => s.status === "failed_qc").length;
  const dpmo = Math.round((failedScans / (total * stationCount)) * 1_000_000);

  let downtimeMins = 0;
  for (const s of allScans) {
    if (s.downtime_start && s.downtime_end) {
      downtimeMins += (new Date(s.downtime_end).getTime() - new Date(s.downtime_start).getTime()) / 60_000;
    }
  }

  return {
    oee, fpy, throughput, avgCycleTime,
    scrapRate, reworkRate, dpmo,
    downtimeMins: Math.round(downtimeMins),
    totalStarted: total,
    targetCycleTime: 32,
  };
}

export default function ManufacturingKPIs() {
  const { isDemo } = useDemoMode();
  const [kpis, setKpis] = useState<ManufacturingKPIs | null>(null);

  useEffect(() => {
    if (isDemo) { setKpis(mockMfgKpis); return; }
    fetchMfgKpis().then(setKpis);
  }, [isDemo]);

  if (!kpis) return <Skeleton />;

  const cycleColor: CardColor = kpis.avgCycleTime > kpis.targetCycleTime ? "red" : "green";

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--muted)" }}>Manufacturing KPIs</h3>
      <div className="grid grid-cols-4 gap-4">
        <MfgCard title="OEE"                value={`${kpis.oee}%`}                        sub="Target: 85%"                      color={oeeColor(kpis.oee)}   barPct={kpis.oee} />
        <MfgCard title="First Pass Yield"   value={`${kpis.fpy}%`}                        sub="Parts right first time"           color={fpyColor(kpis.fpy)}   barPct={kpis.fpy} />
        <MfgCard title="Throughput"         value={`${kpis.throughput}`}                  sub="parts / hour"                     color="blue" />
        <MfgCard title="Avg Cycle Time"     value={`${kpis.avgCycleTime} min`}            sub={`vs ${kpis.targetCycleTime} min target`} color={cycleColor} barPct={Math.min(100, (kpis.avgCycleTime / kpis.targetCycleTime) * 100)} />
        <MfgCard title="Scrap Rate"         value={`${kpis.scrapRate}%`}                  sub="Green <2% / Amber 2-5% / Red >5%" color={scrapColor(kpis.scrapRate)} />
        <MfgCard title="Rework Rate"        value={`${kpis.reworkRate}%`}                 sub="Green <5% / Amber 5-10% / Red >10%" color={reworkColor(kpis.reworkRate)} />
        <MfgCard title="DPMO"               value={kpis.dpmo.toLocaleString()}            sub="Defects per million opportunities" color={kpis.dpmo < 10000 ? "green" : "red"} context={dpmoContext(kpis.dpmo)} />
        <MfgCard title="Downtime Reported"  value={kpis.downtimeMins > 0 ? `${kpis.downtimeMins} min` : "0 min"} sub={kpis.downtimeMins > 0 ? "Total downtime today" : "None reported"} color={kpis.downtimeMins === 0 ? "green" : kpis.downtimeMins < 30 ? "amber" : "red"} />
      </div>
    </div>
  );
}
