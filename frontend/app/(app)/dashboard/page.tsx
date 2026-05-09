import DashboardTabs from "@/components/dashboard-tabs";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { PartKPIs } from "@/lib/types";

async function fetchDashboardData(): Promise<{
  kpis: PartKPIs;
  hasLines: boolean;
  hasParts: boolean;
}> {
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
  const activeLines = new Set((wipLineRows ?? []).map((p) => p.line_id)).size;

  if (hasParts) {
    return {
      kpis: {
        partsInProduction: wipCount ?? 0,
        releasedToday:     doneCount ?? 0,
        reworkFailed:      failedCount ?? 0,
        activeLines,
      },
      hasLines,
      hasParts,
    };
  }

  // Old tables empty — try new tables (scan_events / shifts)
  const db2 = createServiceClient();
  const { data: latestShift } = await db2
    .from("shifts")
    .select("id")
    .order("start_time", { ascending: false })
    .limit(1)
    .single();

  if (latestShift) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: scanRows } = await db2
      .from("scan_events")
      .select("part_id, station_name, scan_type, scanned_at")
      .eq("shift_id", latestShift.id);

    if (scanRows && scanRows.length > 0) {
      const allParts = new Set(scanRows.filter((r) => r.part_id).map((r) => r.part_id as string));
      const released = new Set(
        scanRows
          .filter((r) => r.scan_type === "exit" && r.station_name === "Packaging" && r.part_id && new Date(r.scanned_at) >= today)
          .map((r) => r.part_id as string)
      );
      const packagingExits = new Set(
        scanRows.filter((r) => r.scan_type === "exit" && r.station_name === "Packaging" && r.part_id).map((r) => r.part_id as string)
      );
      const defects = new Set(scanRows.filter((r) => r.scan_type === "defect" && r.part_id).map((r) => r.part_id as string));
      const wip = new Set([...allParts].filter((id) => !packagingExits.has(id)));

      return {
        kpis: {
          partsInProduction: wip.size,
          releasedToday:     released.size,
          reworkFailed:      defects.size,
          activeLines:       1,
        },
        hasLines: true,
        hasParts: allParts.size > 0,
      };
    }
  }

  return {
    kpis: {
      partsInProduction: 0,
      releasedToday:     0,
      reworkFailed:      0,
      activeLines:       0,
    },
    hasLines,
    hasParts,
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
