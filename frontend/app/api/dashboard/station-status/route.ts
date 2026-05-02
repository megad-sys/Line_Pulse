import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type StationRow = {
  station_name: string;
  sequence_order: number;
  target_mins: number;
  parts_here: number;
  rework_parts: number;
  completed_today: number;
  avg_cycle_mins: number | null;
};

export type LineStatus = {
  line_id: string;
  line_name: string;
  stations: StationRow[];
  total_wip: number;
};

export type StationStatusResponse = {
  lines: LineStatus[];
  isDemo: boolean;
};

// ── Mock data ──────────────────────────────────────────────────

const MOCK_LINES: LineStatus[] = [
  {
    line_id: "mock-line-1",
    line_name: "Assembly Line A",
    total_wip: 48,
    stations: [
      { station_name: "SMT",              sequence_order: 0, target_mins: 5,   parts_here: 12, rework_parts: 0, completed_today: 45, avg_cycle_mins: 5.2  },
      { station_name: "Soldering",         sequence_order: 1, target_mins: 5.5, parts_here: 8,  rework_parts: 2, completed_today: 38, avg_cycle_mins: 6.1  },
      { station_name: "Visual Inspection", sequence_order: 2, target_mins: 6.4, parts_here: 23, rework_parts: 0, completed_today: 31, avg_cycle_mins: 14.8 },
      { station_name: "Functional Test",   sequence_order: 3, target_mins: 7,   parts_here: 5,  rework_parts: 0, completed_today: 42, avg_cycle_mins: 7.3  },
      { station_name: "Packaging",         sequence_order: 4, target_mins: 4.5, parts_here: 0,  rework_parts: 0, completed_today: 40, avg_cycle_mins: 4.4  },
    ],
  },
  {
    line_id: "mock-line-2",
    line_name: "Assembly Line B",
    total_wip: 17,
    stations: [
      { station_name: "Machining",  sequence_order: 0, target_mins: 10, parts_here: 6,  rework_parts: 0, completed_today: 28, avg_cycle_mins: 9.1  },
      { station_name: "Grinding",   sequence_order: 1, target_mins: 7,  parts_here: 11, rework_parts: 1, completed_today: 22, avg_cycle_mins: 8.2  },
      { station_name: "Assembly",   sequence_order: 2, target_mins: 8,  parts_here: 0,  rework_parts: 0, completed_today: 19, avg_cycle_mins: 8.0  },
    ],
  },
];

// ── Route ──────────────────────────────────────────────────────

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { data: lines },
    { data: allStations },
    { data: wipParts },
    { data: reworkParts },
    { data: todayScans },
  ] = await Promise.all([
    supabase
      .from("production_lines")
      .select("id, name")
      .order("created_at", { ascending: true }),
    supabase
      .from("line_stations")
      .select("id, line_id, station_name, sequence_order, target_mins")
      .order("sequence_order", { ascending: true }),
    supabase
      .from("parts")
      .select("line_id, current_station")
      .eq("current_status", "wip"),
    supabase
      .from("parts")
      .select("line_id, current_station")
      .eq("current_status", "failed_qc"),
    supabase
      .from("scans")
      .select("part_id, work_order_id, station_name, status, scanned_at")
      .gte("scanned_at", todayStart.toISOString())
      .in("status", ["started", "completed"]),
  ]);

  if (!lines || lines.length === 0) {
    return NextResponse.json({ lines: MOCK_LINES, isDemo: true } satisfies StationStatusResponse);
  }

  // Cycle time map: station_name → [minutes between started/completed pairs]
  const cycleMap: Record<string, number[]> = {};
  // Completed-today count: station_name → count
  const completedToday: Record<string, number> = {};

  if (todayScans) {
    const started: Record<string, Date> = {};
    for (const scan of todayScans) {
      const key = `${scan.part_id ?? scan.work_order_id}-${scan.station_name}`;
      if (scan.status === "started") {
        started[key] = new Date(scan.scanned_at);
      } else if (scan.status === "completed") {
        completedToday[scan.station_name] = (completedToday[scan.station_name] ?? 0) + 1;
        if (started[key]) {
          const mins = (new Date(scan.scanned_at).getTime() - started[key].getTime()) / 60_000;
          if (!cycleMap[scan.station_name]) cycleMap[scan.station_name] = [];
          cycleMap[scan.station_name].push(mins);
          delete started[key];
        }
      }
    }
  }

  // WIP parts at station: line_id → station_name → count
  const wipAt: Record<string, Record<string, number>> = {};
  for (const p of wipParts ?? []) {
    if (!wipAt[p.line_id]) wipAt[p.line_id] = {};
    wipAt[p.line_id][p.current_station] = (wipAt[p.line_id][p.current_station] ?? 0) + 1;
  }

  // Rework parts at station: line_id → station_name → count
  const reworkAt: Record<string, Record<string, number>> = {};
  for (const p of reworkParts ?? []) {
    if (!reworkAt[p.line_id]) reworkAt[p.line_id] = {};
    reworkAt[p.line_id][p.current_station] = (reworkAt[p.line_id][p.current_station] ?? 0) + 1;
  }

  const result: LineStatus[] = lines.map((line) => {
    const stations: StationRow[] = (allStations ?? [])
      .filter((s) => s.line_id === line.id)
      .map((s) => {
        const times = cycleMap[s.station_name] ?? [];
        const avg =
          times.length > 0
            ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10
            : null;
        return {
          station_name:    s.station_name,
          sequence_order:  s.sequence_order,
          target_mins:     s.target_mins,
          parts_here:      wipAt[line.id]?.[s.station_name] ?? 0,
          rework_parts:    reworkAt[line.id]?.[s.station_name] ?? 0,
          completed_today: completedToday[s.station_name] ?? 0,
          avg_cycle_mins:  avg,
        };
      });

    const total_wip = stations.reduce((sum, s) => sum + s.parts_here, 0);
    return { line_id: line.id, line_name: line.name, stations, total_wip };
  });

  return NextResponse.json({ lines: result, isDemo: false } satisfies StationStatusResponse);
}
