-- ============================================================
-- FactoryOS — AI Alerts (written by the /api/agent cron)
-- Run after 004_part_scans.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_alerts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('critical', 'warning', 'info')),
  title       text        NOT NULL,
  detail      text        NOT NULL,
  station     text,
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_tenant ON ai_alerts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_unread ON ai_alerts (tenant_id, is_read) WHERE NOT is_read;

ALTER TABLE ai_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ai_alerts;
CREATE POLICY "tenant_isolation" ON ai_alerts
  FOR ALL USING (tenant_id = get_user_tenant_id());
