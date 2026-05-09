export type WorkOrderStatus = "planned" | "wip" | "qc" | "done" | "delayed";
export type Priority = "low" | "medium" | "high" | "urgent";
export type InsightType = "critical" | "warning" | "info" | "positive";

export interface PartKPIs {
  partsInProduction: number;
  releasedToday: number;
  reworkFailed: number;
  activeLines: number;
}
export type ScanStatus = "started" | "completed" | "failed_qc";

export interface WorkOrder {
  id: string;
  tenant_id: string;
  wo_number: string;
  customer_name: string;
  part_number: string;
  variant?: string;
  planned_qty: number;
  actual_qty: number;
  units_scrapped: number;
  due_date: string;
  status: WorkOrderStatus;
  priority: Priority;
  stations: string[];
  station_targets?: Record<string, number>;
  material_cost?: number;
  serial_tracking: boolean;
  notes?: string;
  line_id?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface Station {
  name: string;
  cycleTime: number;
  target: number;
  qcFailures: number;
  isBottleneck?: boolean;
}

export interface AIInsight {
  type: InsightType;
  title: string;
  detail: string;
  action?: string;
  /** @deprecated kept for mock data backwards compat */
  body?: string;
  time?: string;
}

export interface KPIs {
  unitsProduced: number;
  unitsPlanned: number;
  qcFailures: number;
  failureRate: number;
  avgCycleTime: number;
  cycleTimeTarget: number;
  activeWorkOrders: number;
}

export interface Scan {
  id: string;
  tenant_id: string;
  work_order_id: string;
  serial_number?: string;
  station_name: string;
  status: ScanStatus;
  disposition?: string;
  operator_name?: string;
  worker_note?: string;
  scanned_at: string;
  shift?: string;
  downtime_reason?: string;
  downtime_start?: string;
  downtime_end?: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  role: "admin" | "worker";
  full_name: string;
  created_at: string;
}

export interface ManufacturingKPIs {
  oee: number;
  fpy: number;
  throughput: number;
  avgCycleTime: number;
  scrapRate: number;
  reworkRate: number;
  dpmo: number;
  downtimeMins: number;
  totalStarted: number;
  targetCycleTime: number;
}

export interface ChartDay {
  label: string;
  date: string;
  planned: number;
  produced: number;
}

export interface ProductionResult {
  one_line_summary: string;
  top_priority: string;
  action_required: boolean;
  handover_notes: string;
  worst_station: string;
  avg_cycle_mins: number;
  target_cycle_mins: number;
  bottleneck_score: number;
  severity: "critical" | "warning" | "ok";
  stall_detected: boolean;
  stall_duration_mins: number | null;
  queue_depth: number;
  recommendation: string;
}

export interface QualityResult {
  worst_station: string;
  worst_station_defect_rate_pct: number;
  total_defects: number;
  overall_defect_rate_pct: number;
  severity: "critical" | "warning" | "ok";
  trend: "rising" | "stable" | "improving";
  recommendation: string;
}

export interface PlanningResult {
  plan_attainment_pct: number;
  projected_eod_units: number;
  planned_units: number;
  gap_units: number;
  closeable_this_shift: boolean;
  at_risk_work_orders: string[];
  recommended_sequence: Array<{
    wo_number: string;
    part_name: string;
    customer_name: string;
    customer_priority: "critical" | "high" | "normal";
    reason: string;
  }>;
  recommendation: string;
}

export interface OrchestratorResult {
  computed_at: string;
  shift_id: string;
  duration_ms: number;
  context_summary: {
    stations_count: number;
    units_completed: number;
    hours_remaining: number;
  };
  agents: {
    production: ProductionResult | { error: string };
    quality: QualityResult | { error: string };
    planning: PlanningResult | { error: string };
  };
}

export interface AgentAlert {
  id: string;
  detected_at: string;
  alert_type: "stall" | "quality_spike";
  station_name: string;
  severity: "critical" | "warning";
  stall_duration_mins: number | null;
  resolved_at: string | null;
  resolved_by: string | null;
}
