-- ============================================================
-- LinePulse — Agent Actions
-- Audit log of every operator approval and its execution result.
-- Also extends agent_alerts.alert_type to cover all alert types
-- the system will ever write — defined once here to avoid
-- incremental ALTER TABLE migrations for each new scenario.
-- ============================================================

-- Extend agent_alerts.alert_type
ALTER TABLE agent_alerts
  DROP CONSTRAINT IF EXISTS agent_alerts_alert_type_check;

ALTER TABLE agent_alerts
  ADD CONSTRAINT agent_alerts_alert_type_check
  CHECK (alert_type IN (
    'stall',
    'quality_spike',
    'bottleneck',
    'pace_critical',
    'stall_acknowledged',
    'fpy_breach',
    'escalation',
    'due_date_risk',
    'wo_priority_conflict',
    'agent_logged',
    'maintenance',
    'inspection',
    'handover',
    'anomaly'
  ));

-- ── agent_actions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_actions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES tenants ON DELETE CASCADE,
  line_id             uuid        REFERENCES production_lines ON DELETE SET NULL,
  shift_id            text,
  agent_alert_id      uuid        REFERENCES agent_alerts ON DELETE SET NULL,
  agent_type          text        NOT NULL
                                  CHECK (agent_type IN ('production','quality','planning')),
  recommendation_text text        NOT NULL,
  custom_instruction  text,
  approved_by         text        NOT NULL,
  approved_at         timestamptz NOT NULL DEFAULT now(),
  status              text        NOT NULL DEFAULT 'executing'
                                  CHECK (status IN ('executing','completed','failed')),
  level               integer     CHECK (level IN (1, 2)),
  execution_result    text,
  actions_taken       text[],
  tools_used          text[],
  completed_at        timestamptz
);

ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON agent_actions;
CREATE POLICY "tenant_isolation" ON agent_actions
  FOR ALL USING (tenant_id = get_user_tenant_id());
