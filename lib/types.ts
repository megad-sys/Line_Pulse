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

export interface Escalation {
  id: string;
  triggered_at: string;
  issue_detail: string;
  severity: "critical" | "warning";
  assigned_to: string;
  status: "notified" | "pending";
}
