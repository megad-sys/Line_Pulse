import { Suspense } from "react";
import Link from "next/link";
import KpiCard from "@/components/kpi-card";
import KpiSkeleton from "@/components/kpi-skeleton";
import AIInsightsPanel from "@/components/ai-insights-panel";
import StationStatusTable from "@/components/station-status-table";
import PartStatusTable from "@/components/part-status-table";
import { createClient } from "@/lib/supabase/server";
import { mockPartKpis } from "@/lib/mock-data";
import type { PartKPIs } from "@/lib/types";

type DashboardData = {
  kpis: PartKPIs;
  hasLines: boolean;
  hasParts: boolean;
  isDemo: boolean;
};

async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: linesCount },
    { count: totalParts },
    { count: wipCount },
    { count: doneCount },
    { count: failedCount },
    { data: wipLineRows },
  ] = await Promise.all([
    supabase.from("production_lines").select("*", { count: "exact", head: true }),
    supabase.from("parts").select("*", { count: "exact", head: true }),
    supabase.from("parts").select("*", { count: "exact", head: true }).eq("current_status", "wip"),
    supabase
      .from("parts")
      .select("*", { count: "exact", head: true })
      .eq("current_status", "done")
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("parts")
      .select("*", { count: "exact", head: true })
      .in("current_status", ["failed_qc", "scrapped"]),
    supabase.from("parts").select("line_id").eq("current_status", "wip"),
  ]);

  const hasLines = (linesCount ?? 0) > 0;
  const hasParts = (totalParts ?? 0) > 0;

  if (!hasLines) {
    return { kpis: mockPartKpis, hasLines: false, hasParts: false, isDemo: true };
  }

  const activeLines = new Set((wipLineRows ?? []).map((p) => p.line_id)).size;

  return {
    kpis: {
      partsInProduction: wipCount ?? 0,
      releasedToday: doneCount ?? 0,
      reworkFailed: failedCount ?? 0,
      activeLines,
    },
    hasLines,
    hasParts,
    isDemo: false,
  };
}

export default async function DashboardPage() {
  const { kpis, hasLines, hasParts, isDemo } = await fetchDashboardData();

  const now = new Date();
  const shiftLabel = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Production Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">{shiftLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500">Live</span>
          </div>
        </div>

        {/* AI Production Engineer — hero panel */}
        <div className="mb-5">
          <AIInsightsPanel />
        </div>

        {/* KPI cards */}
        <Suspense fallback={<KpiSkeleton />}>
          <div className="grid grid-cols-4 gap-4 mb-5">
            <KpiCard
              label="Parts in Production"
              value={`${kpis.partsInProduction}`}
              sub="currently in progress"
              color="blue"
            />
            <KpiCard
              label="Released Today"
              value={`${kpis.releasedToday}`}
              sub="completed this shift"
              color="green"
            />
            <KpiCard
              label="Rework / Failed"
              value={`${kpis.reworkFailed}`}
              sub="need attention"
              color="red"
            />
            <KpiCard
              label="Active Lines"
              value={`${kpis.activeLines}`}
              sub="lines with WIP parts"
              color="blue"
            />
          </div>
        </Suspense>

        {/* FIX 6 — Onboarding cards OR tables */}
        {!hasLines ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-amber-900 text-sm">Set up your production line first</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Define your lines and stations before creating parts or scanning QR codes.
              </p>
            </div>
            <Link
              href="/dashboard/settings/lines"
              className="shrink-0 ml-6 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Set Up Lines →
            </Link>
          </div>
        ) : !hasParts ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900 text-sm">Ready — start your first batch</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Your line is set up. Create a batch of parts to begin tracking production.
              </p>
            </div>
            <Link
              href="/dashboard/parts/new"
              className="shrink-0 ml-6 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              New Batch →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            <StationStatusTable />
            <PartStatusTable />
          </div>
        )}

        {/* Demo: show tables below onboarding card so manager sees mock data */}
        {isDemo && (
          <div className="grid grid-cols-2 gap-5 mt-5">
            <StationStatusTable />
            <PartStatusTable />
          </div>
        )}
      </div>
    </div>
  );
}
