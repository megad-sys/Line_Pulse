-- disposition on scan_events
-- Tracks the outcome of a part at a station.
-- Set on exit scans: released = passed all stations, rework = needs rework,
-- scrap = scrapped, on_hold = held, wip = still in progress (default).

ALTER TABLE scan_events
  ADD COLUMN IF NOT EXISTS disposition text
  CHECK (disposition IN ('wip', 'released', 'rework', 'scrap', 'on_hold'));
