import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

// ── New-table fallback ─────────────────────────────────────────

const STATION_ORDER = ["SMT Assembly", "Soldering", "Visual Inspection", "Functional Test", "Packaging"];

async function fetchFromNewTables(): Promise<StationStatusResponse | null> {
  const db = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const { data: latestShift } = await db
    .from("shifts")
    .select("id")
    .order("start_time", { ascending: false })
    .limit(1)
    .single();

  if (!latestShift) return null;

  const [{ data: events }, { data: configs }] = await Promise.all([
    db
      .from("scan_events")
      .select("part_id, station_name, scan_type, scanned_at")
      .eq("shift_id", latestShift.id)
      .order("scanned_at", { ascending: true }),
    db.from("station_config").select("station_name, target_cycle_mins"),
  ]);

  const rows = events ?? [];
  if (rows.length === 0) return null;

  const targetMap = new Map<string, number>(
    (configs ?? []).map((c) => [c.station_name, Number(c.target_cycle_mins)])
  );

  const stationNames = Array.from(new Set(rows.map((r) => r.station_name)));

  const stations: StationRow[] = stationNames.map((station) => {
    const sRows = rows.filter((r) => r.station_name === station);
    const target = targetMap.get(station) ?? 10;
    const entries = new Map<string, string>();
    const cycleMins: number[] = [];
    let defect_count = 0;

    for (const row of sRows) {
      if (row.scan_type === "entry" && row.part_id) {
        entries.set(row.part_id, row.scanned_at);
      } else if (row.scan_type === "exit" && row.part_id) {
        const entryTime = entries.get(row.part_id);
        if (entryTime) {
          cycleMins.push((new Date(row.scanned_at).getTime() - new Date(entryTime).getTime()) / 60000);
          entries.delete(row.part_id);
        }
      } else if (row.scan_type === "defect") {
        defect_count++;
      }
    }

    const avg_cycle_mins =
      cycleMins.length >= 3
        ? Math.round((cycleMins.reduce((s, v) => s + v, 0) / cycleMins.length) * 10) / 10
        : null;

    const completed_today = sRows.filter(
      (r) => r.scan_type === "exit" && new Date(r.scanned_at) >= todayStart
    ).length;

    const seqIdx = STATION_ORDER.indexOf(station);
    return {
      station_name:    station,
      sequence_order:  seqIdx === -1 ? 999 : seqIdx,
      target_mins:     target,
      parts_here:      entries.size,
      rework_parts:    defect_count,
      completed_today,
      avg_cycle_mins,
    };
  });

  stations.sort((a, b) => a.sequence_order - b.sequence_order);
  const total_wip = stations.reduce((s, r) => s + r.parts_here, 0);

  return {
    lines: [{ line_id: "demo-line-1", line_name: "Assembly Line", stations, total_wip }],
    isDemo: false,
  };
}

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
    // Try new tables (scan_events / station_config)
    const newTableResult = await fetchFromNewTables();
    if (newTableResult) {
      return NextResponse.json(newTableResult satisfies StationStatusResponse);
    }
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
