-- ============================================================
-- FactoryOS — Allow scans to reference parts (not only work orders)
-- Run after 003_parts.sql
-- ============================================================

-- work_order_id is now optional (part scans don't have one)
ALTER TABLE scans ALTER COLUMN work_order_id DROP NOT NULL;

-- Add part reference
ALTER TABLE scans ADD COLUMN IF NOT EXISTS part_id uuid REFERENCES parts ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_scans_part ON scans (part_id);
