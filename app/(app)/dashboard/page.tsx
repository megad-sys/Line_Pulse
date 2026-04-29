import { Suspense } from "react";
import KpiCard from "@/components/kpi-card";
import KpiSkeleton from "@/components/kpi-skeleton";
import StatusPill from "@/components/status-pill";
import ProgressBar from "@/components/progress-bar";
import StationChart from "@/components/station-chart";
import QCChart from "@/components/qc-chart";
import AIInsightsPanel from "@/components/ai-insights-panel";
import DemoBanner from "@/components/demo-banner";
import { createClient } from "@/lib/supabase/server";
import { mockKpis, mockWorkOrders, mockStations } from "@/lib/mock-data";
import { woProgress } from "@/lib/utils";
import type { WorkOrder, Station, KPIs } from "@/lib/types";

async function fetchDashboardData() {
  const supabase = createClient();

  const today = new Date().toISOString().split("T")[0];
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

  const [{ data: workOrders }, { data: scans }] = await Promise.all([
    supabase
      .from("work_orders")
      .select("*")
      .or(`status.in.(wip,qc,delayed),due_date.eq.${today}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("scans")
      .select("*")
      .gte("scanned_at", eightHoursAgo),
  ]);

  const isEmpty = !workOrders || workOrders.length === 0;
  if (isEmpty) return { workOrders: mockWorkOrders, stations: mockStations, kpis: mockKpis, isDemo: true };

  // Compute KPIs from real data
  const activeWOs = (workOrders as WorkOrder[]).filter(
    (w) => w.status === "wip" || w.status === "qc" || w.status === "delayed"
  );
  const unitsProduced = (workOrders as WorkOrder[]).reduce((s, w) => s + (w.actual_qty ?? 0), 0);
  const unitsPlanned = (workOrders as WorkOrder[]).reduce((s, w) => s + (w.planned_qty ?? 0), 0);
  const qcFailures = (scans ?? []).filter((s) => s.status === "failed_qc").length;
  const failureRate = unitsProduced > 0 ? Math.round((qcFailures / unitsProduced) * 1000) / 10 : 0;

  // Compute per-station cycle times from start→complete pairs
  const stationMap: Record<string, { times: number[]; failures: number }> = {};

  if (scans) {
    const started: Record<string, { station: string; time: Date }> = {};

    for (const scan of scans) {
      const key = `${scan.work_order_id}-${scan.station_name}`;
      if (scan.status === "started") {
        started[key] = { station: scan.station_name, time: new Date(scan.scanned_at) };
      } else if (scan.status === "completed" && started[key]) {
        const cycleMinutes =
          (new Date(scan.scanned_at).getTime() - started[key].time.getTime()) / 60000;
        if (!stationMap[scan.station_name]) stationMap[scan.station_name] = { times: [], failures: 0 };
        stationMap[scan.station_name].times.push(cycleMinutes);
        delete started[key];
      } else if (scan.status === "failed_qc") {
        if (!stationMap[scan.station_name]) stationMap[scan.station_name] = { times: [], failures: 0 };
        stationMap[scan.station_name].failures++;
      }
    }
  }

  // Build station list from config or infer from scans
  const allStationNames = Array.from(
    new Set([
      ...(workOrders as WorkOrder[]).flatMap((w) => w.stations ?? []),
      ...Object.keys(stationMap),
    ])
  );

  const stations: Station[] = allStationNames.map((name) => {
    const metrics = stationMap[name] ?? { times: [], failures: 0 };
    const cycleTime =
      metrics.times.length > 0
        ? Math.round((metrics.times.reduce((a, b) => a + b, 0) / metrics.times.length) * 10) / 10
        : 0;
    return { name, cycleTime, target: 6, qcFailures: metrics.failures, isBottleneck: false };
  });

  // Mark bottleneck: station with highest cycle time that exceeds its target
  const maxCycle = Math.max(...stations.map((s) => s.cycleTime));
  stations.forEach((s) => {
    s.isBottleneck = s.cycleTime === maxCycle && s.cycleTime > s.target;
  });

  const avgCycleTime =
    stations.length > 0
      ? Math.round(stations.reduce((sum, s) => sum + s.cycleTime, 0) / stations.length)
      : 0;

  const kpis: KPIs = {
    unitsProduced,
    unitsPlanned,
    qcFailures,
    failureRate,
    avgCycleTime,
    cycleTimeTarget: 32,
    activeWorkOrders: activeWOs.length,
  };

  return { workOrders: workOrders as WorkOrder[], stations, kpis, isDemo: false };
}

export default async function DashboardPage() {
  const { workOrders, stations, kpis, isDemo } = await fetchDashboardData();

  const now = new Date();
  const shiftLabel = `${now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Production Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Shift 1 · {shiftLabel} · Line 1</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500">Live</span>
          </div>
        </div>

        {isDemo && <DemoBanner />}

        <div className="flex gap-6">
          {/* Left: main content */}
          <div className="flex-1 min-w-0 flex flex-col gap-5">
            {/* KPI row */}
            <Suspense fallback={<KpiSkeleton />}>
              <div className="grid grid-cols-4 gap-4">
                <KpiCard
                  label="Units Produced"
                  value={`${kpis.unitsProduced}`}
                  sub={`of ${kpis.unitsPlanned} planned`}
                  color="blue"
                  progress={kpis.unitsPlanned > 0 ? Math.round((kpis.unitsProduced / kpis.unitsPlanned) * 100) : 0}
                />
                <KpiCard
                  label="QC Failures"
                  value={`${kpis.qcFailures}`}
                  sub={`${kpis.failureRate}% failure rate`}
                  color="amber"
                />
                <KpiCard
                  label="Avg Cycle Time"
                  value={`${kpis.avgCycleTime}m`}
                  sub={`target: ${kpis.cycleTimeTarget}m`}
                  color={kpis.avgCycleTime > kpis.cycleTimeTarget ? "red" : "green"}
                />
                <KpiCard
                  label="Active Work Orders"
                  value={`${kpis.activeWorkOrders}`}
                  sub="across all stations"
                  color="gray"
                />
              </div>
            </Suspense>

            {/* Plan vs Actual table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Plan vs Actual</h2>
                <span className="text-xs text-gray-400 font-mono">
                  {workOrders.length} work orders
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    {["WO ID", "Customer", "Part", "Progress", "Status", "Current Station"].map((h) => (
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
                  {workOrders.map((wo, i) => (
                    <tr
                      key={wo.id}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        i < workOrders.length - 1 ? "border-b border-gray-50" : ""
                      }`}
                    >
                      <td className="pl-5 pr-4 py-3 font-mono text-xs text-gray-500">{wo.wo_number}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{wo.customer_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{wo.part_number}</td>
                      <td className="px-4 py-3 w-36">
                        <ProgressBar
                          value={woProgress(wo.actual_qty, wo.planned_qty)}
                          color={
                            wo.status === "delayed"
                              ? "bg-red-500"
                              : wo.status === "done"
                              ? "bg-green-500"
                              : "bg-blue-500"
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={wo.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {wo.stations?.[wo.stations.length - 1] ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-2 gap-4">
              <StationChart data={stations} />
              <QCChart data={stations} />
            </div>
          </div>

          {/* Right: AI panel */}
          <div className="w-80 shrink-0">
            <div
              className="sticky top-6 bg-white rounded-xl border border-gray-100 p-5 shadow-sm overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 5rem)" }}
            >
              <AIInsightsPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
