"use client";

import { useState } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { LayoutGrid, BarChart2 } from "lucide-react";
import KpiCard from "@/components/kpi-card";
import KpiSkeleton from "@/components/kpi-skeleton";
import StationStatusTable from "@/components/station-status-table";
import PartStatusTable from "@/components/part-status-table";
import AIInsightsPanel from "@/components/ai-insights-panel";
import ManufacturingKPIs from "@/components/manufacturing-kpis";
import PlannedVsProduced from "@/components/planned-vs-produced";
import EscalationCenter from "@/components/escalation-center";
import { useDemoMode } from "@/lib/demo-context";
import { mockPartKpis } from "@/lib/mock-data";
import type { PartKPIs } from "@/lib/types";

type Tab = "floor" | "analytics";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "floor",     label: "Floor",     icon: <LayoutGrid size={18} /> },
  { id: "analytics", label: "Analytics", icon: <BarChart2  size={18} /> },
];

export default function DashboardTabs({
  serverKpis,
  serverHasLines,
  serverHasParts,
}: {
  serverKpis: PartKPIs;
  serverHasLines: boolean;
  serverHasParts: boolean;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("floor");
  const { isDemo } = useDemoMode();

  const kpis     = isDemo ? mockPartKpis : serverKpis;
  const hasLines = isDemo ? true : serverHasLines;
  const hasParts = isDemo ? true : serverHasParts;

  return (
    /* Outer row: content + right tab rail */
    <div className="flex gap-0 items-start">

      {/* ── Content area ──────────────────────────────────────── */}
      <div className="flex-1 min-w-0 pr-4">

        {/* ── Floor tab ──────────────────────────────────────── */}
        {activeTab === "floor" && (
          <div className="flex flex-col gap-5">
            <Suspense fallback={<KpiSkeleton />}>
              <div className="grid grid-cols-4 gap-4">
                <KpiCard label="Parts in Production" value={`${kpis.partsInProduction}`} sub="currently in progress" color="blue" />
                <KpiCard label="Released Today"       value={`${kpis.releasedToday}`}    sub="completed this shift"  color="green" />
                <KpiCard label="Rework / Failed"      value={`${kpis.reworkFailed}`}     sub="need attention"        color="red" />
                <KpiCard label="Active Lines"         value={`${kpis.activeLines}`}      sub="lines with WIP parts"  color="blue" />
              </div>
            </Suspense>

            {!hasLines ? (
              <div
                className="rounded-xl px-6 py-5 flex items-center justify-between"
                style={{ backgroundColor: "#1f1500", border: "1px solid #5c3d00" }}
              >
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#fbbf24" }}>
                    Set up your production line first
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#a37b00" }}>
                    Define your lines and stations before creating parts or scanning QR codes.
                  </p>
                </div>
                <Link
                  href="/dashboard/settings/lines"
                  className="shrink-0 ml-6 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: "#e8ff47", color: "#0f0f0e" }}
                >
                  Set Up Lines →
                </Link>
              </div>
            ) : !hasParts ? (
              <div
                className="rounded-xl px-6 py-5 flex items-center justify-between"
                style={{ backgroundColor: "#001526", border: "1px solid #0c3d66" }}
              >
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#60a5fa" }}>
                    Ready — start your first batch
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#1d6fa3" }}>
                    Your line is set up. Create a batch of parts to begin tracking production.
                  </p>
                </div>
                <Link
                  href="/dashboard/parts/new"
                  className="shrink-0 ml-6 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: "#e8ff47", color: "#0f0f0e" }}
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

            {isDemo && !hasParts && (
              <div className="grid grid-cols-2 gap-5">
                <StationStatusTable />
                <PartStatusTable />
              </div>
            )}
          </div>
        )}

        {/* ── Analytics tab ──────────────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="flex flex-col gap-8">
            <AIInsightsPanel />
            <ManufacturingKPIs />
            <PlannedVsProduced />
            <EscalationCenter />
          </div>
        )}
      </div>

      {/* ── Right tab rail ────────────────────────────────────── */}
      <div
        className="sticky top-0 self-start shrink-0 flex flex-col border-l"
        style={{
          width: 64,
          minHeight: "calc(100vh - 3.5rem)",
          backgroundColor: "#1a1916",
          borderColor: "#2e2e2b",
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              className="flex flex-col items-center gap-1.5 px-2 py-4 w-full transition-colors relative"
              style={{
                backgroundColor: active ? "#222220" : "transparent",
                borderLeft: active ? "2px solid #e8ff47" : "2px solid transparent",
                color: active ? "#e8ff47" : "#7a7870",
              }}
            >
              {tab.icon}
              <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
