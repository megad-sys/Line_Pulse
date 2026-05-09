-- ============================================================
-- LinePulse — Agent System v2
-- New tables for the agentic AI layer.
-- Existing tables (scans, shifts_config, stations_config,
-- ai_alerts) are untouched — the current system keeps working.
-- ============================================================

-- ── Layer 1: Execution data ───────────────────────────────────
-- scan_events: entry/exit/defect events from QR or CSV import.
-- Agents read this. Workers write this (via /api/scan or CSV).

CREATE TABLE IF NOT EXISTS scan_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  work_order_id uuid        REFERENCES work_orders ON DELETE CASCADE,
  part_id       text,
  station_name  text        NOT NULL,
  scan_type     text        NOT NULL CHECK (scan_type IN ('entry','exit','defect')),
  scanned_at    timestamptz NOT NULL DEFAULT now(),
  operator_id   text,
  source        text        CHECK (source IN ('qr','csv_import')) DEFAULT 'qr',
  shift_id      uuid
);

CREATE INDEX IF NOT EXISTS idx_scan_events_shift_station
  ON scan_events (tenant_id, shift_id, station_name, scanned_at);
CREATE INDEX IF NOT EXISTS idx_scan_events_part
  ON scan_events (tenant_id, shift_id, part_id, station_name);

-- ── shifts ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shifts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  date        date        NOT NULL,
  shift_name  text        NOT NULL,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shifts_tenant_time
  ON shifts (tenant_id, start_time, end_time);

-- ── station_config ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS station_config (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid    NOT NULL REFERENCES tenants ON DELETE CASCADE,
  station_name      text    NOT NULL,
  target_cycle_mins numeric NOT NULL,
  UNIQUE (tenant_id, station_name)
);

-- ── agent_alerts ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_alerts (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  work_order_id        uuid        REFERENCES work_orders ON DELETE CASCADE,
  shift_id             uuid        REFERENCES shifts ON DELETE CASCADE,
  part_id              text,
  alert_type           text        NOT NULL CHECK (alert_type IN ('stall','quality_spike')),
  station_name         text        NOT NULL,
  severity             text        NOT NULL CHECK (severity IN ('critical','warning')),
  stall_duration_mins  numeric,
  detected_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at          timestamptz,
  resolved_by          text
);

CREATE INDEX IF NOT EXISTS idx_agent_alerts_unresolved
  ON agent_alerts (tenant_id, resolved_at, severity, detected_at);

-- ── agent_runs ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid,
  shift_id    text        NOT NULL,
  ran_at      timestamptz NOT NULL DEFAULT now(),
  result_json jsonb,
  duration_ms integer
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_shift
  ON agent_runs (shift_id, ran_at DESC);

-- ── Extend work_orders for the agent system ───────────────────
-- agent_shift_id: links this WO to an agent-system shift.
-- priority, due_date, customer_priority: Layer 2 plan fields.
-- Phase 1: filled manually or via CSV.
-- Phase 2: ERP webhook populates automatically.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS agent_shift_id uuid
    REFERENCES shifts(id) ON DELETE SET NULL;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 5;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS due_date timestamptz;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS customer_priority text
    DEFAULT 'normal'
    CHECK (customer_priority IN ('critical','high','normal'));

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE scan_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_alerts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON scan_events;
CREATE POLICY "tenant_isolation" ON scan_events
  FOR ALL USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON shifts;
CREATE POLICY "tenant_isolation" ON shifts
  FOR ALL USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON station_config;
CREATE POLICY "tenant_isolation" ON station_config
  FOR ALL USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON agent_alerts;
CREATE POLICY "tenant_isolation" ON agent_alerts
  FOR ALL USING (tenant_id = get_user_tenant_id());

-- agent_runs: tenant_id is nullable (some runs are cross-tenant).
-- Allow reads where tenant matches or tenant_id is null.
DROP POLICY IF EXISTS "tenant_isolation" ON agent_runs;
CREATE POLICY "tenant_isolation" ON agent_runs
  FOR ALL USING (
    tenant_id IS NULL OR tenant_id = get_user_tenant_id()
  );
