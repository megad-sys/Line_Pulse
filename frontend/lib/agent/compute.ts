import { createServiceClient } from "@/lib/supabase/server";

// ── Interfaces ────────────────────────────────────────────────

// Layer 1 — Execution data (computed from scan_events)
export interface StationMetrics {
  station_name: string;
  target_cycle_mins: number;
  avg_cycle_mins: number | null;   // null if < 3 completed pairs
  units_completed: number;
  queue_depth: number;
  stall_detected: boolean;
  stall_duration_mins: number | null;
  defect_count: number;
  defect_rate_pct: number;
  bottleneck_score: number | null; // null if avg_cycle_mins is null
}

export interface ShiftSummary {
  hours_elapsed: number;
  hours_remaining: number;
  units_completed_total: number;
  planned_units_total: number;
  plan_attainment_pct: number;
  throughput_per_hour: number;
  projected_eod_units: number;
  total_defects: number;
  overall_defect_rate_pct: number;
}

// Layer 2 — Plan data (from work_orders) merged with execution progress
export interface WorkOrderStatus {
  work_order_id: string;
  wo_number: string;
  part_name: string;
  customer_name: string;
  quantity_planned: number;
  // execution progress (derived from scan_events)
  units_completed: number;
  progress_pct: number;
  current_station: string | null;
  last_scan_at: string | null;
  is_stalled: boolean;
  minutes_since_last_scan: number | null;
  // planning fields — Phase 1: manual/CSV; Phase 2: ERP webhook
  priority: number;
  due_date: string | null;
  customer_priority: "critical" | "high" | "normal";
}

export interface AgentContext {
  shift_id: string;
  computed_at: string;
  stations: StationMetrics[];
  shift: ShiftSummary;
  work_orders: WorkOrderStatus[];
}

// ── Helpers ───────────────────────────────────────────────────

const LAST_STATION = "Packaging";

function diffMins(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

// ── getStationMetrics ─────────────────────────────────────────

export async function getStationMetrics(shiftId: string): Promise<StationMetrics[]> {
  const db = createServiceClient();
  const now = new Date().toISOString();

  const [{ data: events }, { data: configs }] = await Promise.all([
    db
      .from("scan_events")
      .select("station_name, scan_type, scanned_at, part_id")
      .eq("shift_id", shiftId)
      .order("scanned_at", { ascending: true }),
    db.from("station_config").select("station_name, target_cycle_mins"),
  ]);

  const rows = events ?? [];
  const targetMap = new Map<string, number>(
    (configs ?? []).map((c) => [c.station_name, Number(c.target_cycle_mins)])
  );

  // Group by station
  const stationNames = Array.from(new Set(rows.map((r) => r.station_name)));

  return stationNames.map((station) => {
    const stationRows = rows.filter((r) => r.station_name === station);
    const target = targetMap.get(station) ?? 10;

    // Pair entry→exit by part_id
    const entries = new Map<string, string>(); // part_id → scanned_at
    const cycleMins: number[] = [];

    for (const row of stationRows) {
      if (row.scan_type === "entry" && row.part_id) {
        entries.set(row.part_id, row.scanned_at);
      } else if (row.scan_type === "exit" && row.part_id) {
        const entryTime = entries.get(row.part_id);
        if (entryTime) {
          cycleMins.push(diffMins(entryTime, row.scanned_at));
          entries.delete(row.part_id);
        }
      }
    }

    const units_completed = stationRows.filter((r) => r.scan_type === "exit").length;
    const defect_count = stationRows.filter((r) => r.scan_type === "defect").length;
    const avg_cycle_mins =
      cycleMins.length >= 3
        ? cycleMins.reduce((s, v) => s + v, 0) / cycleMins.length
        : null;

    // Queue: parts with entry but no exit yet
    const queue_depth = entries.size;

    // Stall: any queued part overdue by 1.5×
    let stall_detected = false;
    let worst_stall: number | null = null;
    for (const entryTime of entries.values()) {
      const elapsed = diffMins(entryTime, now);
      if (elapsed > target * 1.5) {
        stall_detected = true;
        if (worst_stall === null || elapsed > worst_stall) worst_stall = elapsed;
      }
    }

    return {
      station_name: station,
      target_cycle_mins: target,
      avg_cycle_mins,
      units_completed,
      queue_depth,
      stall_detected,
      stall_duration_mins: worst_stall,
      defect_count,
      defect_rate_pct: units_completed > 0 ? (defect_count / units_completed) * 100 : 0,
      bottleneck_score: avg_cycle_mins !== null ? (avg_cycle_mins / target) * 100 : null,
    };
  });
}

// ── getShiftSummary ───────────────────────────────────────────

export async function getShiftSummary(shiftId: string): Promise<ShiftSummary> {
  const db = createServiceClient();
  const now = new Date();

  const [{ data: shift }, { data: events }, { data: wos }] = await Promise.all([
    db.from("shifts").select("start_time, end_time").eq("id", shiftId).single(),
    db
      .from("scan_events")
      .select("scan_type, station_name, scanned_at")
      .eq("shift_id", shiftId),
    db
      .from("work_orders")
      .select("quantity_planned")
      .eq("agent_shift_id", shiftId),
  ]);

  const start = shift ? new Date(shift.start_time) : now;
  const end = shift ? new Date(shift.end_time) : now;

  const hours_elapsed = Math.max(0, (now.getTime() - start.getTime()) / 3600000);
  const hours_remaining = Math.max(0, (end.getTime() - now.getTime()) / 3600000);

  const rows = events ?? [];
  const finishedExits = rows.filter(
    (r) => r.scan_type === "exit" && r.station_name === LAST_STATION
  );
  const units_completed_total = finishedExits.length;
  const planned_units_total = (wos ?? []).reduce(
    (s, w) => s + (w.quantity_planned ?? 0),
    0
  );
  const total_defects = rows.filter((r) => r.scan_type === "defect").length;
  const throughput_per_hour =
    hours_elapsed > 0 ? units_completed_total / hours_elapsed : 0;
  const projected = units_completed_total + throughput_per_hour * hours_remaining;

  return {
    hours_elapsed,
    hours_remaining,
    units_completed_total,
    planned_units_total,
    plan_attainment_pct:
      planned_units_total > 0
        ? (units_completed_total / planned_units_total) * 100
        : 0,
    throughput_per_hour,
    projected_eod_units: Math.min(projected, planned_units_total),
    total_defects,
    overall_defect_rate_pct:
      units_completed_total > 0
        ? (total_defects / units_completed_total) * 100
        : 0,
  };
}

// ── getWorkOrderStatus ────────────────────────────────────────

export async function getWorkOrderStatus(shiftId: string): Promise<WorkOrderStatus[]> {
  const db = createServiceClient();
  const now = new Date().toISOString();

  const [{ data: wos }, { data: events }, { data: configs }] = await Promise.all([
    db
      .from("work_orders")
      .select(
        "id, wo_number, part_number, customer_name, quantity_planned, priority, due_date, customer_priority"
      )
      .eq("agent_shift_id", shiftId),
    db
      .from("scan_events")
      .select("work_order_id, scan_type, station_name, scanned_at")
      .eq("shift_id", shiftId)
      .order("scanned_at", { ascending: false }),
    db.from("station_config").select("station_name, target_cycle_mins"),
  ]);

  const rows = events ?? [];
  const targetMap = new Map<string, number>(
    (configs ?? []).map((c) => [c.station_name, Number(c.target_cycle_mins)])
  );

  return (wos ?? []).map((wo) => {
    const woRows = rows.filter((r) => r.work_order_id === wo.id);

    const units_completed = woRows.filter(
      (r) => r.scan_type === "exit" && r.station_name === LAST_STATION
    ).length;

    const latest = woRows[0]; // already ordered desc
    const current_station = latest?.station_name ?? null;
    const last_scan_at = latest?.scanned_at ?? null;

    let is_stalled = false;
    let minutes_since_last_scan: number | null = null;

    if (last_scan_at && current_station) {
      minutes_since_last_scan = diffMins(last_scan_at, now);
      const target = targetMap.get(current_station) ?? 10;
      is_stalled = minutes_since_last_scan > target * 1.5;
    }

    return {
      work_order_id: wo.id,
      wo_number: wo.wo_number,
      part_name: wo.part_number ?? "",
      customer_name: wo.customer_name ?? "",
      quantity_planned: wo.quantity_planned ?? 0,
      units_completed,
      progress_pct:
        wo.quantity_planned > 0
          ? (units_completed / wo.quantity_planned) * 100
          : 0,
      current_station,
      last_scan_at,
      is_stalled,
      minutes_since_last_scan,
      priority: wo.priority ?? 5,
      due_date: wo.due_date ?? null,
      customer_priority: (wo.customer_priority as "critical" | "high" | "normal") ?? "normal",
    };
  });
}

// ── buildAgentContext ─────────────────────────────────────────
// TODO Phase 2: MES connector replaces or supplements scan_events
// for enterprise customers. buildAgentContext() signature does not change.

export async function buildAgentContext(shiftId: string): Promise<AgentContext> {
  const [stations, shift, work_orders] = await Promise.all([
    getStationMetrics(shiftId),
    getShiftSummary(shiftId),
    getWorkOrderStatus(shiftId),
  ]);

  return {
    shift_id: shiftId,
    computed_at: new Date().toISOString(),
    stations,
    shift,
    work_orders,
  };
}
