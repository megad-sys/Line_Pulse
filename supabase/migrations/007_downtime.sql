-- Add downtime scan types to scan_events
-- Downtime is recorded as a pair of events at the station level:
--   downtime_start → operator scans to log machine stop
--   downtime_end   → operator scans to log machine resume
-- downtime_reason is set on the downtime_start event only.

ALTER TABLE scan_events
  DROP CONSTRAINT IF EXISTS scan_events_scan_type_check;

ALTER TABLE scan_events
  ADD CONSTRAINT scan_events_scan_type_check
  CHECK (scan_type IN ('entry', 'exit', 'defect', 'downtime_start', 'downtime_end'));

ALTER TABLE scan_events
  ADD COLUMN IF NOT EXISTS downtime_reason text;
