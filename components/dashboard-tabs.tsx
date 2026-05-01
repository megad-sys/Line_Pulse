"use client";

import { useState } from "react";
import Link from "next/link";
import { Suspense } from "react";
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

const TABS: { id: Tab; label: string }[] = [
  { id: "floor",     label: "Floor"     },
  { id: "analytics", label: "Analytics" },
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
    <div>
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Floor tab ────────────────────────────────────────── */}
      {activeTab === "floor" && (
        <div className="flex flex-col gap-5">

          {/* KPI row */}
          <Suspense fallback={<KpiSkeleton />}>
            <div className="grid grid-cols-4 gap-4">
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

          {/* Onboarding OR tables */}
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

          {/* Demo: always show tables below the onboarding card */}
          {isDemo && !hasParts && (
            <div className="grid grid-cols-2 gap-5">
              <StationStatusTable />
              <PartStatusTable />
            </div>
          )}
        </div>
      )}

      {/* ── Analytics tab ─────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="flex flex-col gap-8">
          <AIInsightsPanel />
          <ManufacturingKPIs />
          <PlannedVsProduced />
          <EscalationCenter />
        </div>
      )}
    </div>
  );
}
