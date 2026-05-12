import type { WorkOrder, Station, AIInsight, KPIs, PartKPIs, ManufacturingKPIs, ChartDay, AgentAlert } from "./types";

export const mockKpis: KPIs = {
  unitsProduced: 187,
  unitsPlanned: 240,
  qcFailures: 14,
  failureRate: 7.5,
  avgCycleTime: 38,
  cycleTimeTarget: 32,
  activeWorkOrders: 9,
};

export const mockPartKpis: PartKPIs = {
  partsInProduction: 33,
  releasedToday: 47,
  reworkFailed: 6,
  activeLines: 1,
};

export const mockWorkOrders: WorkOrder[] = [
  {
    id: "mock-wo-1",
    tenant_id: "mock-tenant",
    wo_number: "WO-2024-0051",
    customer_name: "Siemens AG",
    part_number: "PCB Control Unit",
    planned_qty: 240,
    actual_qty: 187,
    units_scrapped: 0,
    status: "wip",
    priority: "high",
    stations: ["SMT", "Soldering", "Visual Inspection", "Functional Test", "Packaging"],
    serial_tracking: false,
    due_date: "2024-04-25",
    created_at: new Date().toISOString(),
    line_id: "Line 1",
  },
  {
    id: "mock-wo-2",
    tenant_id: "mock-tenant",
    wo_number: "WO-2024-0052",
    customer_name: "Bosch GmbH",
    part_number: "Motor Driver Board",
    planned_qty: 150,
    actual_qty: 142,
    units_scrapped: 0,
    status: "qc",
    priority: "medium",
    stations: ["SMT", "Soldering", "Visual Inspection", "Functional Test", "Packaging"],
    serial_tracking: false,
    due_date: "2024-04-24",
    created_at: new Date().toISOString(),
  },
  {
    id: "mock-wo-3",
    tenant_id: "mock-tenant",
    wo_number: "WO-2024-0053",
    customer_name: "CONTAG AG",
    part_number: "Sensor Interface",
    planned_qty: 80,
    actual_qty: 80,
    units_scrapped: 0,
    status: "done",
    priority: "low",
    stations: ["SMT", "Soldering", "Visual Inspection", "Functional Test", "Packaging"],
    serial_tracking: false,
    due_date: "2024-04-23",
    created_at: new Date().toISOString(),
  },
  {
    id: "mock-wo-4",
    tenant_id: "mock-tenant",
    wo_number: "WO-2024-0054",
    customer_name: "Eolane SysCom",
    part_number: "RF Amplifier Module",
    planned_qty: 200,
    actual_qty: 61,
    units_scrapped: 0,
    status: "delayed",
    priority: "urgent",
    stations: ["SMT", "Soldering", "Visual Inspection", "Functional Test", "Packaging"],
    serial_tracking: false,
    due_date: "2024-04-23",
    created_at: new Date().toISOString(),
  },
  {
    id: "mock-wo-5",
    tenant_id: "mock-tenant",
    wo_number: "WO-2024-0055",
    customer_name: "Daimler AG",
    part_number: "CAN Bus Controller",
    planned_qty: 120,
    actual_qty: 0,
    units_scrapped: 0,
    status: "planned",
    priority: "medium",
    stations: ["SMT", "Soldering", "Visual Inspection", "Functional Test", "Packaging"],
    serial_tracking: false,
    due_date: "2024-04-26",
    created_at: new Date().toISOString(),
  },
  {
    id: "mock-wo-6",
    tenant_id: "mock-tenant",
    wo_number: "WO-2024-0056",
    customer_name: "CYBERTRON GmbH",
    part_number: "Kinematic Servo Board",
    planned_qty: 60,
    actual_qty: 38,
    units_scrapped: 0,
    status: "wip",
    priority: "high",
    stations: ["SMT", "Soldering", "Visual Inspection", "Functional Test", "Packaging"],
    serial_tracking: false,
    due_date: "2024-04-27",
    created_at: new Date().toISOString(),
  },
];

export const mockStations: Station[] = [
  { name: "SMT", cycleTime: 5.2, target: 5.0, qcFailures: 1, isBottleneck: false },
  { name: "Soldering", cycleTime: 6.1, target: 5.5, qcFailures: 2, isBottleneck: false },
  { name: "Visual Inspection", cycleTime: 14.8, target: 6.4, qcFailures: 11, isBottleneck: true },
  { name: "Functional Test", cycleTime: 7.3, target: 7.0, qcFailures: 0, isBottleneck: false },
  { name: "Packaging", cycleTime: 4.4, target: 4.5, qcFailures: 0, isBottleneck: false },
];

export const mockInsights: AIInsight[] = [
  {
    type: "critical",
    title: "Visual Inspection is your bottleneck",
    detail: "14.8 min avg vs 10 min target. 3 parts currently stuck here — the longest queue on Line A. At this pace, you will produce 211 units vs 240 planned today.",
    action: "Assign a second operator to Visual Inspection",
  },
  {
    type: "warning",
    title: "FPY dropped to 93.2%",
    detail: "Up from 5.4% failure rate yesterday. All failures concentrated at Visual Inspection — likely a tooling or operator issue, not a component defect.",
    action: "Inspect Visual Inspection station tooling",
  },
  {
    type: "warning",
    title: "At current pace: 211 units vs 240 planned",
    detail: "The bottleneck at Visual Inspection is reducing throughput by 3.2 parts/hr. Without intervention, today's target will be missed by 29 units.",
    action: "Re-prioritise high-priority batches upstream",
  },
  {
    type: "info",
    title: "Functional Test running 7.3 min — 4% over target",
    detail: "Small overrun vs the 7 min target. Not yet critical but worth monitoring — if throughput at Visual Inspection improves, this could become the next constraint.",
  },
  {
    type: "positive",
    title: "Soldering running under target all shift",
    detail: "6.1 min avg vs 6 min target — effectively on target. Morning team performing consistently. SMT also within range at 5.2 min vs 8 min target.",
  },
];

// ── Station status (CHANGE 5 spec) ───────────────────────────────

export const mockStationStatus = {
  lines: [
    {
      line_id:    "mock-line-a",
      line_name:  "Line A — PCB Assembly",
      total_wip:  33,
      stations: [
        { station_name: "SMT Assembly",     sequence_order: 0, target_mins: 8,  parts_here: 12, rework_parts: 0, completed_today: 12, avg_cycle_mins: 5.2  },
        { station_name: "Soldering",         sequence_order: 1, target_mins: 6,  parts_here: 8,  rework_parts: 0, completed_today: 18, avg_cycle_mins: 6.1  },
        { station_name: "Visual Inspection", sequence_order: 2, target_mins: 10, parts_here: 3,  rework_parts: 2, completed_today: 9,  avg_cycle_mins: 14.8 },
        { station_name: "Functional Test",   sequence_order: 3, target_mins: 7,  parts_here: 6,  rework_parts: 0, completed_today: 14, avg_cycle_mins: 7.3  },
        { station_name: "Packaging",         sequence_order: 4, target_mins: 4,  parts_here: 4,  rework_parts: 0, completed_today: 47, avg_cycle_mins: 4.4  },
      ],
    },
  ],
  isDemo: true,
} as const;

// ── Manufacturing KPIs (CHANGE 2 spec) ──────────────────────────

export const mockMfgKpis: ManufacturingKPIs = {
  oee:            71,
  fpy:            93.2,
  throughput:     23.4,
  avgCycleTime:   38,
  scrapRate:      1.2,
  defectFlagRate: 6.9,
  dpmo:           8200,
  downtimeMins:   47,
  totalStarted:   93,
  targetCycleTime: 32,
};

// ── Planned vs Produced chart data (CHANGE 3 spec) ──────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function dayLabel(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

export const mockChartData: ChartDay[] = [
  { date: daysAgo(6), label: dayLabel(6), planned: 80, produced: 74 },
  { date: daysAgo(5), label: dayLabel(5), planned: 80, produced: 81 },
  { date: daysAgo(4), label: dayLabel(4), planned: 80, produced: 68 },
  { date: daysAgo(3), label: dayLabel(3), planned: 80, produced: 77 },
  { date: daysAgo(2), label: dayLabel(2), planned: 80, produced: 82 },
  { date: daysAgo(1), label: dayLabel(1), planned: 40, produced: 38 },
  { date: daysAgo(0), label: "Today",     planned: 80, produced: 33 },
];

// ── Agent Alerts (from agent_alerts table) ────────────────────────

export const mockAgentAlerts: AgentAlert[] = [
  {
    id: "alert-1",
    detected_at: new Date(Date.now() - 3.75 * 3600000).toISOString(),
    alert_type: "quality_spike",
    station_name: "Visual Inspection",
    severity: "critical",
    stall_duration_mins: null,
    resolved_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    resolved_by: "Quality Engineer",
  },
  {
    id: "alert-2",
    detected_at: new Date(Date.now() - 2.46 * 3600000).toISOString(),
    alert_type: "stall",
    station_name: "Visual Inspection",
    severity: "warning",
    stall_duration_mins: 14.8,
    resolved_at: null,
    resolved_by: null,
  },
  {
    id: "alert-3",
    detected_at: new Date(Date.now() - 1.25 * 3600000).toISOString(),
    alert_type: "quality_spike",
    station_name: "Functional Test",
    severity: "critical",
    stall_duration_mins: null,
    resolved_at: null,
    resolved_by: null,
  },
];
