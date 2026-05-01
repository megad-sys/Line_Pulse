-- ============================================================
-- FactoryOS — Analytics tables
-- daily_targets + escalations
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_targets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  date       date        NOT NULL,
  target_qty integer     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, date)
);

ALTER TABLE daily_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON daily_targets;
CREATE POLICY "tenant_isolation" ON daily_targets
  FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE TABLE IF NOT EXISTS escalations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  issue_type   text,
  issue_detail text,
  severity     text        NOT NULL DEFAULT 'warning',
  assigned_to  text,
  status       text        NOT NULL DEFAULT 'notified',
  triggered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON escalations;
CREATE POLICY "tenant_isolation" ON escalations
  FOR ALL USING (tenant_id = get_user_tenant_id());
