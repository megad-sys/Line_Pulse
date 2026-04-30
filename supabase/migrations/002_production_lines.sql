-- ============================================================
-- FactoryOS — Production Lines + Line Stations
-- Run after 001_initial_schema.sql
-- Safe to re-run: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS production_lines (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_stations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  line_id        uuid        NOT NULL REFERENCES production_lines ON DELETE CASCADE,
  station_name   text        NOT NULL,
  target_mins    integer     NOT NULL DEFAULT 5,
  sequence_order integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_stations_line ON line_stations (line_id, sequence_order);

ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON production_lines;
CREATE POLICY "tenant_isolation" ON production_lines
  FOR ALL USING (tenant_id = get_user_tenant_id());

ALTER TABLE line_stations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON line_stations;
CREATE POLICY "tenant_isolation" ON line_stations
  FOR ALL USING (tenant_id = get_user_tenant_id());
