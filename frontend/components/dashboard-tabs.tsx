"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DataSourceModal } from "@/components/data-source-modal";
import { LayoutGrid, BarChart2, Settings2, PenLine, Bot } from "lucide-react";
import StationStatusTable from "@/components/station-status-table";
import PartStatusTable from "@/components/part-status-table";
import ShiftAnalysisPanel from "@/components/shift-analysis-panel";
import ManufacturingKPIs from "@/components/manufacturing-kpis";
import PlannedVsProduced from "@/components/planned-vs-produced";
import EscalationCenter from "@/components/escalation-center";
import CustomerLineSetup from "@/components/customer-line-setup";
import Whiteboard from "@/components/whiteboard";
import AiAgentPanel from "@/components/ai-agent-panel";
import AgentPulseStrip from "@/components/agent-pulse-strip";
import ScrapReworkStats from "@/components/scrap-rework-stats";
import { useDemoMode } from "@/lib/demo-context";
import { mockPartKpis } from "@/lib/mock-data";
import type { PartKPIs } from "@/lib/types";

type Tab = "shopfloor" | "analytics" | "setup" | "whiteboard" | "agents";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "shopfloor",  label: "Shopfloor",  icon: <LayoutGrid size={18} /> },
  { id: "agents",     label: "Agents",     icon: <Bot        size={18} /> },
  { id: "analytics",  label: "Analytics",  icon: <BarChart2  size={18} /> },
  { id: "setup",      label: "Setup",      icon: <Settings2  size={18} /> },
  { id: "whiteboard", label: "Board",      icon: <PenLine    size={18} /> },
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
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<"production" | "quality">("production");
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    return (["shopfloor", "analytics", "setup", "whiteboard", "agents"].includes(t ?? "") ? t : "shopfloor") as Tab;
  });
  const { isDemo } = useDemoMode();

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && ["shopfloor", "analytics", "setup", "whiteboard", "agents"].includes(t)) {
      setActiveTab(t as Tab);
    }
  }, [searchParams]);

  const kpis     = isDemo ? mockPartKpis : serverKpis;
  const hasLines = isDemo ? true : serverHasLines;
  const hasParts = isDemo ? true : serverHasParts;

  return (
    <>
    <DataSourceModal />
    <div className="flex gap-0 items-start">

      {/* ── Content area ──────────────────────────────────────── */}
      <div className="flex-1 min-w-0 pr-4">

        {/* ── Shopfloor tab ──────────────────────────────────── */}
        {activeTab === "shopfloor" && (
          <div className="flex flex-col gap-5">

            {/* Dashboard view switcher */}
            <div className="flex items-center gap-1 self-start rounded-lg p-1"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              {(["production", "quality"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className="px-4 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize"
                  style={{
                    backgroundColor: activeView === view ? "#2e2e2b" : "transparent",
                    color: activeView === view ? "#f0ede8" : "var(--muted)",
                    borderLeft: activeView === view ? "none" : "none",
                  }}>
                  {view === "production" ? "Production Dashboard" : "Quality Dashboard"}
                </button>
              ))}
            </div>

            {/* Production view */}
            {activeView === "production" && (
              <>
                <div className="flex items-stretch rounded-xl border overflow-hidden"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                  {[
                    { label: "In Production",  value: kpis.partsInProduction, color: "#60a5fa", sub: "parts active now" },
                    { label: "Released Today", value: kpis.releasedToday,    color: "#4ade80", sub: "completed this shift" },
                    { label: "Rework / Failed",value: kpis.reworkFailed,     color: "#f87171", sub: "need attention" },
                    { label: "Active Lines",   value: kpis.activeLines,      color: "#60a5fa", sub: "lines with WIP" },
                  ].map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-center px-6 py-4 border-r last:border-r-0"
                      style={{ borderColor: "var(--border)" }}>
                      <span className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>{m.label}</span>
                      <span className="text-3xl font-bold font-mono" style={{ color: m.color }}>{m.value}</span>
                      <span className="text-xs mt-1" style={{ color: "var(--subtle)" }}>{m.sub}</span>
                    </div>
                  ))}
                </div>

                {!hasLines ? (
                  <div className="rounded-xl px-6 py-5 flex items-center justify-between"
                    style={{ backgroundColor: "#1f1500", border: "1px solid #5c3d00" }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "#fbbf24" }}>Set up your production line first</p>
                      <p className="text-xs mt-0.5" style={{ color: "#a37b00" }}>
                        Define your lines and stations before creating parts or scanning QR codes.
                      </p>
                    </div>
                    <button onClick={() => setActiveTab("setup")}
                      className="shrink-0 ml-6 text-sm font-semibold px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500">
                      Set Up Lines →
                    </button>
                  </div>
                ) : !hasParts ? (
                  <div className="rounded-xl px-6 py-5 flex items-center justify-between"
                    style={{ backgroundColor: "#001526", border: "1px solid #0c3d66" }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "#60a5fa" }}>Ready — start your first batch</p>
                      <p className="text-xs mt-0.5" style={{ color: "#1d6fa3" }}>
                        Your line is set up. Create a batch of parts to begin tracking production.
                      </p>
                    </div>
                    <button onClick={() => setActiveTab("setup")}
                      className="shrink-0 ml-6 text-sm font-semibold px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500">
                      New Batch →
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    <AgentPulseStrip onViewAgents={() => setActiveTab("agents")} />
                    <div id="station-status" className="grid grid-cols-2 gap-5">
                      <StationStatusTable />
                      <PartStatusTable />
                    </div>
                    <div id="mfg-kpis">
                      <ManufacturingKPIs />
                    </div>
                    <PlannedVsProduced />
                  </div>
                )}

                {isDemo && !hasParts && (
                  <div className="flex flex-col gap-5">
                    <AgentPulseStrip onViewAgents={() => setActiveTab("agents")} />
                    <div id="station-status" className="grid grid-cols-2 gap-5">
                      <StationStatusTable />
                      <PartStatusTable />
                    </div>
                    <div id="mfg-kpis">
                      <ManufacturingKPIs />
                    </div>
                    <PlannedVsProduced />
                  </div>
                )}
              </>
            )}

            {/* Quality view */}
            {activeView === "quality" && (
              <ScrapReworkStats />
            )}
          </div>
        )}

        {/* ── Analytics tab ──────────────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="flex flex-col gap-6">
            <ShiftAnalysisPanel />
            <EscalationCenter />
          </div>
        )}

        {/* ── Setup tab ──────────────────────────────────────── */}
        {activeTab === "setup" && (
          <CustomerLineSetup />
        )}

        {/* ── Whiteboard tab ─────────────────────────────────── */}
        {activeTab === "whiteboard" && (
          <Whiteboard />
        )}

        {/* ── Agents tab ─────────────────────────────────────── */}
        {activeTab === "agents" && (
          <AiAgentPanel />
        )}
      </div>

      {/* ── Right tab rail ────────────────────────────────────── */}
      <div className="sticky top-0 self-start shrink-0 flex flex-col border-l"
        style={{ width: 64, minHeight: "calc(100vh - 3.5rem)", backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.label}
              className="flex flex-col items-center gap-1.5 px-2 py-4 w-full transition-colors relative"
              style={{
                backgroundColor: active ? "#2e2e2b" : "transparent",
                borderLeft: active ? "2px solid #60a5fa" : "2px solid transparent",
                color: active ? "#60a5fa" : "var(--muted)",
              }}>
              {tab.icon}
              <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
    </>
  );
}
