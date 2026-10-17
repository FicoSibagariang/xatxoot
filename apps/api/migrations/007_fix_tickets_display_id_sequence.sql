-- Migration 007: Fix tickets.display_id sequence and enforce unique constraint
-- Single Organization Rule (No Multi-tenant)

-- 1. Renumber existing tickets based on created_at to resolve duplicate display_id values
WITH numbered AS (
  SELECT id, 1000 + ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS new_display_id
  FROM tickets
)
UPDATE tickets t
SET display_id = n.new_display_id
FROM numbered n
WHERE t.id = n.id;

-- 2. Synchronize PostgreSQL sequence to current max(display_id) or 1000
SELECT setval(
  pg_get_serial_sequence('tickets', 'display_id'),
  COALESCE((SELECT MAX(display_id) FROM tickets), 1000)
);

-- 3. Enforce UNIQUE constraint on tickets.display_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_display_id_key'
  ) THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_display_id_key UNIQUE (display_id);
  END IF;
END $$;
