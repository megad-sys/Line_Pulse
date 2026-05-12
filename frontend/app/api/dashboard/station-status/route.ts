// CURRENT SYSTEM - reads from scan_events/station_config via fetchFromNewTables()
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

  const result = await fetchFromNewTables();
  if (result) return NextResponse.json(result satisfies StationStatusResponse);
  return NextResponse.json({ lines: MOCK_LINES, isDemo: true } satisfies StationStatusResponse);
}
