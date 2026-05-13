-- ============================================================
-- LinePulse — Tenant Integrations
-- Stores which tools each tenant has enabled and their config.
-- Level 1: notify-only (email, slack, teams, log_issue)
-- Level 2: write operations (change_order_priority, etc.)
-- Level 3: reserved for future external API integrations
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  tool_name   text        NOT NULL CHECK (tool_name IN (
                            -- Level 1: notification only
                            'email',
                            'slack',
                            'teams',
                            'log_issue',
                            -- Level 2: operational writes
                            'change_order_priority',
                            'create_maintenance_ticket',
                            'trigger_quality_inspection',
                            'create_erp_note',
                            'request_replenishment',
                            -- Level 3: reserved
                            'modify_production_schedule',
                            'reroute_work_orders',
                            'update_erp_planning',
                            'allocate_labor'
                          )),
  level       integer     NOT NULL CHECK (level IN (1, 2, 3)),
  enabled     boolean     NOT NULL DEFAULT false,
  config      jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, tool_name)
);

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON tenant_integrations;
CREATE POLICY "tenant_isolation" ON tenant_integrations
  FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_integrations_updated_at ON tenant_integrations;
CREATE TRIGGER tenant_integrations_updated_at
  BEFORE UPDATE ON tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
