-- ============================================================
-- LinePulse — Action Tracker
-- Extends agent_actions for live operational state tracking.
-- ============================================================

-- Add context snapshot (station, severity, priority) so the
-- tracker table has these fields even when agent_alert_id is null.
ALTER TABLE agent_actions
  ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}';

-- Extend status to reflect real operational states.
-- awaiting_human_action: system tools ran; human must carry out the recommendation.
-- completed: reserved for future explicit human confirmation.
ALTER TABLE agent_actions
  DROP CONSTRAINT IF EXISTS agent_actions_status_check;

ALTER TABLE agent_actions
  ADD CONSTRAINT agent_actions_status_check
  CHECK (status IN (
    'executing',
    'awaiting_human_action',
    'completed',
    'failed'
  ));
