// CURRENT SYSTEM - reads from scan_events/shifts tables
// Agent pipeline uses this data
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { PartKPIs, ManufacturingKPIs } from "@/lib/types";
import type { StationStatusResponse, StationRow } from "@/app/api/dashboard/station-status/route";

export type ShopfloorPartRow = {
  label: string;
  pill: string;
  now: number;
  today: number;
  thisWeek: number;
};

export type QualityStationRow = {
  station_name: string;
  units_processed: number;
  defect_count: number;
  defect_rate_pct: number;
  rework_count: number;
  rework_rate_pct: number;
  scrap_count: number;
};

export interface ShopfloorMetrics {
  hasData: boolean;
  kpis: PartKPIs;
  stationStatus: StationStatusResponse;
  mfgKpis: ManufacturingKPIs;
  partStatus: {
    rows: ShopfloorPartRow[];
    total: { now: number; today: number; thisWeek: number };
  };
  qualityByStation: QualityStationRow[];
}

const LAST_STATION = "Packaging";
const INSPECTION_STATIONS = new Set(["Visual Inspection", "Functional Test", "QC", "Inspection"]);

// Known station order for the demo setup
const STATION_ORDER = ["SMT Assembly", "Soldering", "Visual Inspection", "Functional Test", "Packaging"];
function stationSeq(name: string): number {
  const idx = STATION_ORDER.indexOf(name);
  return idx === -1 ? 999 : idx;
}

export async function GET() {
  const db = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  // Latest shift
  const { data: latestShift } = await db
    .from("shifts")
    .select("id, start_time, end_time")
    .order("start_time", { ascending: false })
    .limit(1)
    .single();

  if (!latestShift) {
    return NextResponse.json({ hasData: false });
  }

  const shiftId = latestShift.id;
  const shiftStart = new Date(latestShift.start_time);

  const [{ data: events }, { data: configs }] = await Promise.all([
    db
      .from("scan_events")
      .select("part_id, station_name, scan_type, scanned_at, disposition")
      .eq("shift_id", shiftId)
      .order("scanned_at", { ascending: true }),
    db.from("station_config").select("station_name, target_cycle_mins"),
  ]);

  const rows = events ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ hasData: false });
  }

  const targetMap = new Map<string, number>(
    (configs ?? []).map((c) => [c.station_name, Number(c.target_cycle_mins)])
  );

  // ── Station metrics ───────────────────────────────────────────
  const stationNames = Array.from(new Set(rows.map((r) => r.station_name)));
  const stationEntriesAtEnd = new Map<string, Map<string, string>>(); // station → partId → entryTime
  let totalDowntimeMins = 0;

  const stationRows: StationRow[] = stationNames.map((station) => {
    const sRows = rows.filter((r) => r.station_name === station);
    const target = targetMap.get(station) ?? 10;
    const entries = new Map<string, string>(); // partId → entry scanned_at
    const cycleMins: number[] = [];
    let defect_count = 0;
    let rework_from_disposition = 0;
    let pendingDowntimeStart: string | null = null;
    let station_downtime_mins = 0;

    for (const row of sRows) {
      if (row.scan_type === "entry" && row.part_id) {
        entries.set(row.part_id, row.scanned_at);
      } else if (row.scan_type === "exit" && row.part_id) {
        const entryTime = entries.get(row.part_id);
        if (entryTime) {
          cycleMins.push((new Date(row.scanned_at).getTime() - new Date(entryTime).getTime()) / 60000);
          entries.delete(row.part_id);
        }
        if (row.disposition === "rework") rework_from_disposition++;
      } else if (row.scan_type === "defect") {
        defect_count++;
      } else if (row.scan_type === "downtime_start") {
        pendingDowntimeStart = row.scanned_at;
      } else if (row.scan_type === "downtime_end" && pendingDowntimeStart) {
        station_downtime_mins += (new Date(row.scanned_at).getTime() - new Date(pendingDowntimeStart).getTime()) / 60000;
        pendingDowntimeStart = null;
      }
    }

    // Machine still down: include running duration
    if (pendingDowntimeStart) {
      station_downtime_mins += (now.getTime() - new Date(pendingDowntimeStart).getTime()) / 60000;
    }

    totalDowntimeMins += station_downtime_mins;
    stationEntriesAtEnd.set(station, entries);

    const avg_cycle_mins =
      cycleMins.length >= 3
        ? Math.round((cycleMins.reduce((s, v) => s + v, 0) / cycleMins.length) * 10) / 10
        : null;

    const completed_today = sRows.filter(
      (r) => r.scan_type === "exit" && new Date(r.scanned_at) >= todayStart
    ).length;

    return {
      station_name:    station,
      sequence_order:  stationSeq(station),
      target_mins:     target,
      parts_here:      entries.size,
      // Use disposition-based rework count when available, else fall back to defect scan count
      rework_parts:    rework_from_disposition > 0 ? rework_from_disposition : defect_count,
      completed_today,
      avg_cycle_mins,
    };
  });

  stationRows.sort((a, b) => a.sequence_order - b.sequence_order);
  const total_wip = stationRows.reduce((s, r) => s + r.parts_here, 0);

  const stationStatus: StationStatusResponse = {
    lines: [{
      line_id:    "demo-line-1",
      line_name:  "Assembly Line",
      stations:   stationRows,
      total_wip,
    }],
    isDemo: false,
  };

  // ── Part counts ───────────────────────────────────────────────
  const allPartIds = new Set(rows.filter((r) => r.part_id).map((r) => r.part_id as string));

  function partSet(filterFn: (r: typeof rows[0]) => boolean): Set<string> {
    return new Set(rows.filter((r) => r.part_id && filterFn(r)).map((r) => r.part_id as string));
  }

  const packagingExits      = partSet((r) => r.scan_type === "exit" && r.station_name === LAST_STATION);
  const packagingExitsToday = partSet((r) => r.scan_type === "exit" && r.station_name === LAST_STATION && new Date(r.scanned_at) >= todayStart);
  const packagingExitsWeek  = partSet((r) => r.scan_type === "exit" && r.station_name === LAST_STATION && new Date(r.scanned_at) >= weekStart);
  const defectParts         = partSet((r) => r.scan_type === "defect");
  const defectPartsToday    = partSet((r) => r.scan_type === "defect" && new Date(r.scanned_at) >= todayStart);
  const defectPartsWeek     = partSet((r) => r.scan_type === "defect" && new Date(r.scanned_at) >= weekStart);
  const wipParts            = new Set([...allPartIds].filter((id) => !packagingExits.has(id)));

  // Disposition-based part sets (when disposition column is populated)
  const latestDisposition = new Map<string, string>(); // part_id → latest exit disposition
  for (const row of rows) {
    if (row.scan_type === "exit" && row.part_id && row.disposition) {
      latestDisposition.set(row.part_id, row.disposition);
    }
  }
  const hasDispositionData = latestDisposition.size > 0;

  const dispositionSets = {
    released: hasDispositionData ? new Set([...latestDisposition.entries()].filter(([, d]) => d === "released").map(([id]) => id)) : packagingExits,
    rework:   new Set([...latestDisposition.entries()].filter(([, d]) => d === "rework").map(([id]) => id)),
    scrap:    new Set([...latestDisposition.entries()].filter(([, d]) => d === "scrap").map(([id]) => id)),
    onHold:   new Set([...latestDisposition.entries()].filter(([, d]) => d === "on_hold").map(([id]) => id)),
  };

  const PILL = {
    wip:    "text-[#60a5fa] bg-[#60a5fa]/10 border-[#60a5fa]/20",
    green:  "text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20",
    amber:  "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20",
    red:    "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20",
    muted:  "text-[var(--muted)] bg-[var(--border)] border-[var(--border)]",
  };

  const partRows: ShopfloorPartRow[] = hasDispositionData
    ? [
        { label: "WIP",      pill: PILL.wip,   now: wipParts.size,                today: wipParts.size,                  thisWeek: allPartIds.size              },
        { label: "Released", pill: PILL.green, now: dispositionSets.released.size, today: packagingExitsToday.size,       thisWeek: packagingExitsWeek.size       },
        { label: "Rework",   pill: PILL.amber, now: dispositionSets.rework.size,   today: dispositionSets.rework.size,    thisWeek: dispositionSets.rework.size   },
        { label: "Scrap",    pill: PILL.red,   now: dispositionSets.scrap.size,    today: dispositionSets.scrap.size,     thisWeek: dispositionSets.scrap.size    },
        { label: "On Hold",  pill: PILL.muted, now: dispositionSets.onHold.size,   today: dispositionSets.onHold.size,    thisWeek: dispositionSets.onHold.size   },
      ]
    : [
        { label: "WIP",      pill: PILL.wip,   now: wipParts.size,        today: wipParts.size,            thisWeek: allPartIds.size          },
        { label: "Released", pill: PILL.green, now: packagingExits.size,  today: packagingExitsToday.size,  thisWeek: packagingExitsWeek.size  },
        { label: "Rework",   pill: PILL.amber, now: defectParts.size,     today: defectPartsToday.size,     thisWeek: defectPartsWeek.size     },
        { label: "Scrap",    pill: PILL.red,   now: 0,                    today: 0,                         thisWeek: 0                        },
        { label: "On Hold",  pill: PILL.muted, now: 0,                    today: 0,                         thisWeek: 0                        },
      ];

  const partTotal = {
    now:      partRows.reduce((s, r) => s + r.now, 0),
    today:    partRows.reduce((s, r) => s + r.today, 0),
    thisWeek: partRows.reduce((s, r) => s + r.thisWeek, 0),
  };

  // ── Manufacturing KPIs ─────────────────────────────────────────
  const hoursElapsed = Math.max(0, (now.getTime() - shiftStart.getTime()) / 3600000);
  const totalStarted = allPartIds.size;
  const released     = packagingExits.size;
  const totalDefects = rows.filter((r) => r.scan_type === "defect").length;

  const releasedWithDefects = [...packagingExits].filter((id) => defectParts.has(id)).length;
  const fpy = totalStarted > 0
    ? Math.round(((released - releasedWithDefects) / totalStarted) * 1000) / 10
    : 0;

  const throughput = hoursElapsed > 0
    ? Math.round((released / hoursElapsed) * 10) / 10
    : 0;

  // End-to-end cycle: first entry → Packaging exit
  const firstEntryTime = new Map<string, string>();
  for (const row of rows) {
    if (row.scan_type === "entry" && row.part_id && !firstEntryTime.has(row.part_id)) {
      firstEntryTime.set(row.part_id, row.scanned_at);
    }
  }
  const e2eTimes: number[] = [];
  for (const row of rows) {
    if (row.scan_type === "exit" && row.station_name === LAST_STATION && row.part_id) {
      const entry = firstEntryTime.get(row.part_id);
      if (entry) {
        e2eTimes.push((new Date(row.scanned_at).getTime() - new Date(entry).getTime()) / 60000);
      }
    }
  }
  const avgCycleTime = e2eTimes.length > 0
    ? Math.round(e2eTimes.reduce((s, v) => s + v, 0) / e2eTimes.length)
    : 0;

  // Bottleneck station determines line rate: use max station target, not sum
  const configList = configs ?? [];
  const targetCycleTime = configList.length > 0
    ? Math.round(Math.max(...configList.map((c) => Number(c.target_cycle_mins))))
    : 0;

  const shiftEnd = new Date(latestShift.end_time);
  const shiftDurationMins = (shiftEnd.getTime() - shiftStart.getTime()) / 60000;
  const availability = shiftDurationMins > 0
    ? Math.max(0, (shiftDurationMins - totalDowntimeMins) / shiftDurationMins)
    : 1;

  // OEE Quality: use scrap disposition when available, else defect flag count
  const scrapCount = hasDispositionData ? dispositionSets.scrap.size : defectParts.size;
  const quality = totalStarted > 0 ? (totalStarted - scrapCount) / totalStarted : 1;
  const targetRate = targetCycleTime > 0 ? 60 / targetCycleTime : 0;
  const performance = hoursElapsed > 0 && targetRate > 0
    ? Math.min(1, (released / hoursElapsed) / targetRate)
    : 0;
  const oee = Math.round(availability * performance * quality * 100);

  // Defect flag rate: parts that received any defect scan event
  const defectFlagRate = totalStarted > 0
    ? Math.round((defectParts.size / totalStarted) * 1000) / 10
    : 0;
  // Scrap rate: parts confirmed scrapped via disposition (or 0 if no disposition data)
  const scrapRate = totalStarted > 0 && hasDispositionData
    ? Math.round((dispositionSets.scrap.size / totalStarted) * 1000) / 10
    : 0;
  const stationCount = stationNames.length || 1;
  const dpmo = totalStarted > 0
    ? Math.round((totalDefects / (totalStarted * stationCount)) * 1_000_000)
    : 0;

  const mfgKpis: ManufacturingKPIs = {
    oee,
    fpy,
    throughput,
    avgCycleTime,
    scrapRate,
    defectFlagRate,
    dpmo,
    downtimeMins: Math.round(totalDowntimeMins),
    totalStarted,
    targetCycleTime,
  };

  // ── Quality by station ────────────────────────────────────────
  const qMap = new Map<string, { defects: number; rework: number; scrap: number; exits: number }>();
  for (const row of rows) {
    if (!qMap.has(row.station_name)) qMap.set(row.station_name, { defects: 0, rework: 0, scrap: 0, exits: 0 });
    const q = qMap.get(row.station_name)!;
    if (row.scan_type === "defect") q.defects++;
    if (row.scan_type === "exit") {
      q.exits++;
      if (row.disposition === "rework") q.rework++;
      if (row.disposition === "scrap")  q.scrap++;
    }
  }
  const qualityByStation: QualityStationRow[] = stationNames.map((station) => {
    const q = qMap.get(station) ?? { defects: 0, rework: 0, scrap: 0, exits: 0 };
    const defect_rate_pct = q.exits > 0 ? Math.round((q.defects / q.exits) * 1000) / 10 : 0;
    const rework_rate_pct = q.exits > 0 ? Math.round((q.rework  / q.exits) * 1000) / 10 : 0;
    return {
      station_name:     station,
      units_processed:  q.exits,
      defect_count:     q.defects,
      defect_rate_pct,
      rework_count:     q.rework,
      rework_rate_pct,
      scrap_count:      q.scrap,
    };
  }).sort((a, b) => b.defect_rate_pct - a.defect_rate_pct);

  // ── Top-level KPIs ─────────────────────────────────────────────
  const kpis: PartKPIs = {
    partsInProduction: wipParts.size,
    releasedToday:     packagingExitsToday.size,
    reworkFailed:      defectParts.size,
    activeLines:       1,
  };

  return NextResponse.json({
    hasData: true,
    kpis,
    stationStatus,
    mfgKpis,
    partStatus: { rows: partRows, total: partTotal },
    qualityByStation,
  } satisfies ShopfloorMetrics);
}
