-- ============================================================
-- FactoryOS — Initial Schema
-- Paste this into the Supabase SQL Editor and run it.
-- Safe to re-run: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
-- ============================================================

-- ── Tenants ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  slug            text        NOT NULL UNIQUE,
  employee_count  integer,
  industry        text,
  country         text        NOT NULL DEFAULT 'DE',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Profiles (extends auth.users) ────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'worker')),
  full_name   text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, tenant_id, full_name)
  VALUES (
    new.id,
    COALESCE((new.raw_user_meta_data->>'tenant_id')::uuid, NULL),
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Stations Config ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stations_config (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  station_name    text        NOT NULL,
  target_mins     integer     NOT NULL DEFAULT 5,
  labor_cost_hour decimal(10,2),
  sequence_order  integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, station_name)
);

-- ── Work Orders ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  wo_number        text        NOT NULL,
  customer_name    text        NOT NULL DEFAULT '',
  part_number      text        NOT NULL DEFAULT '',
  variant          text,
  planned_qty      integer     NOT NULL DEFAULT 0,
  actual_qty       integer     NOT NULL DEFAULT 0,
  units_scrapped   integer     NOT NULL DEFAULT 0,
  due_date         date,
  status           text        NOT NULL DEFAULT 'planned'
                               CHECK (status IN ('planned','wip','qc','done','delayed')),
  priority         text        NOT NULL DEFAULT 'medium'
                               CHECK (priority IN ('low','medium','high','urgent')),
  stations         jsonb       NOT NULL DEFAULT '[]',
  station_targets  jsonb       NOT NULL DEFAULT '{}',
  material_cost    decimal(10,4),
  serial_tracking  boolean     NOT NULL DEFAULT false,
  notes            text,
  line_id          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  UNIQUE (tenant_id, wo_number)
);

-- ── Shifts Config ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  name        text        NOT NULL,
  start_time  time        NOT NULL,
  end_time    time        NOT NULL,
  UNIQUE (tenant_id, name)
);

-- ── Scans ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  work_order_id    uuid        REFERENCES work_orders ON DELETE CASCADE,
  serial_number    text,
  station_name     text        NOT NULL,
  status           text        NOT NULL
                               CHECK (status IN ('started','completed','failed_qc')),
  disposition      text        CHECK (disposition IN ('rework','scrap')),
  operator_name    text,
  worker_note      text,
  scanned_at       timestamptz NOT NULL DEFAULT now(),
  shift            text        CHECK (shift IN ('morning','afternoon','night')),
  downtime_reason  text,
  downtime_start   timestamptz,
  downtime_end     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_scans_work_order ON scans (work_order_id);
CREATE INDEX IF NOT EXISTS idx_scans_tenant_scanned ON scans (tenant_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_station ON scans (tenant_id, station_name, scanned_at DESC);

-- ── NCRs (Non-Conformance Reports) ───────────────────────────
CREATE TABLE IF NOT EXISTS ncrs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  work_order_id    uuid        NOT NULL REFERENCES work_orders ON DELETE CASCADE,
  scan_id          uuid        REFERENCES scans ON DELETE SET NULL,
  serial_number    text,
  station_name     text        NOT NULL,
  failure_type     text,
  disposition      text        CHECK (disposition IN ('rework','scrap')),
  status           text        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open','in_review','closed')),
  assigned_to      text,
  resolution_note  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ncrs_work_order ON ncrs (work_order_id);
CREATE INDEX IF NOT EXISTS idx_ncrs_tenant_status ON ncrs (tenant_id, status);

-- ============================================================
-- Row Level Security
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

-- tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON tenants;
CREATE POLICY "tenant_isolation" ON tenants
  FOR ALL USING (id = get_user_tenant_id());

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON profiles;
CREATE POLICY "tenant_isolation" ON profiles
  FOR ALL USING (tenant_id = get_user_tenant_id());

-- stations_config
ALTER TABLE stations_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON stations_config;
CREATE POLICY "tenant_isolation" ON stations_config
  FOR ALL USING (tenant_id = get_user_tenant_id());

-- work_orders
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON work_orders;
CREATE POLICY "tenant_isolation" ON work_orders
  FOR ALL USING (tenant_id = get_user_tenant_id());

-- shifts_config
ALTER TABLE shifts_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON shifts_config;
CREATE POLICY "tenant_isolation" ON shifts_config
  FOR ALL USING (tenant_id = get_user_tenant_id());

-- scans
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON scans;
CREATE POLICY "tenant_isolation" ON scans
  FOR ALL USING (tenant_id = get_user_tenant_id());

-- ncrs
ALTER TABLE ncrs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ncrs;
CREATE POLICY "tenant_isolation" ON ncrs
  FOR ALL USING (tenant_id = get_user_tenant_id());
