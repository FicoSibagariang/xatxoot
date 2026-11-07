-- 015_campaigns_audience.sql
DO $$
BEGIN
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience JSONB NOT NULL DEFAULT '{"type": "all_contacts"}'::jsonb;
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
