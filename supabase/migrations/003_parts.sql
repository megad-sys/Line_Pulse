-- ============================================================
-- FactoryOS — Parts table
-- Run after 002_production_lines.sql
-- Safe to re-run: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS parts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  line_id         uuid        NOT NULL REFERENCES production_lines ON DELETE CASCADE,
  batch_ref       text        NOT NULL,
  qr_code         text        NOT NULL,
  current_status  text        NOT NULL DEFAULT 'wip'
                              CHECK (current_status IN ('wip', 'done', 'failed_qc', 'scrapped')),
  current_station text        NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, qr_code)
);

CREATE INDEX IF NOT EXISTS idx_parts_tenant     ON parts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parts_batch      ON parts (tenant_id, batch_ref);
CREATE INDEX IF NOT EXISTS idx_parts_line       ON parts (line_id);

ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON parts;
CREATE POLICY "tenant_isolation" ON parts
  FOR ALL USING (tenant_id = get_user_tenant_id());
