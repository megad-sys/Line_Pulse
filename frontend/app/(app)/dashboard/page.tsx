// CURRENT SYSTEM - reads from scan_events/shifts
import DashboardTabs from "@/components/dashboard-tabs";
import { createServiceClient } from "@/lib/supabase/server";
import type { PartKPIs } from "@/lib/types";

async function fetchDashboardData(): Promise<{
  kpis: PartKPIs;
  hasLines: boolean;
  hasParts: boolean;
}> {
  const db = createServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: latestShift } = await db
    .from("shifts")
    .select("id")
    .order("start_time", { ascending: false })
    .limit(1)
    .single();

  if (!latestShift) {
    return {
      kpis: { partsInProduction: 0, releasedToday: 0, reworkFailed: 0, activeLines: 0 },
      hasLines: false,
      hasParts: false,
    };
  }

  const { data: scanRows } = await db
    .from("scan_events")
    .select("part_id, work_order_id, station_name, scan_type, scanned_at")
    .eq("shift_id", latestShift.id);

  if (!scanRows || scanRows.length === 0) {
    return {
      kpis: { partsInProduction: 0, releasedToday: 0, reworkFailed: 0, activeLines: 0 },
      hasLines: false,
      hasParts: false,
    };
  }

  function getId(r: { part_id: string | null; work_order_id: string | null }) {
    return r.part_id ?? r.work_order_id;
  }

  const allIds = new Set(scanRows.map(getId).filter(Boolean) as string[]);
  const packagingExits = new Set(
    scanRows.filter((r) => r.scan_type === "exit" && r.station_name === "Packaging" && getId(r)).map(getId) as string[]
  );
  const releasedToday = new Set(
    scanRows
      .filter((r) => r.scan_type === "exit" && r.station_name === "Packaging" && new Date(r.scanned_at) >= today && getId(r))
      .map(getId) as string[]
  );
  const defects = new Set(
    scanRows.filter((r) => r.scan_type === "defect" && getId(r)).map(getId) as string[]
  );
  const wip = new Set([...allIds].filter((id) => !packagingExits.has(id)));

  return {
    kpis: {
      partsInProduction: wip.size,
      releasedToday:     releasedToday.size,
      reworkFailed:      defects.size,
      activeLines:       1,
    },
    hasLines: true,
    hasParts: allIds.size > 0,
  };
}

export default async function DashboardPage() {
  const { kpis, hasLines, hasParts } = await fetchDashboardData();

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Production Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#4ade80" }} />
            <span className="text-sm" style={{ color: "var(--muted)" }}>Live</span>
          </div>
        </div>

        <DashboardTabs
          serverKpis={kpis}
          serverHasLines={hasLines}
          serverHasParts={hasParts}
        />
      </div>
    </div>
  );
}
