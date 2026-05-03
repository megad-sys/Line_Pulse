import DashboardTabs from "@/components/dashboard-tabs";
import { createClient } from "@/lib/supabase/server";
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

export default async function DashboardPage() {
  const { kpis, hasLines, hasParts } = await fetchDashboardData();

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#1a1916" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#f0ede8" }}>Production Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: "#7a7870" }}>{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#4ade80" }} />
            <span className="text-sm" style={{ color: "#7a7870" }}>Live</span>
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
