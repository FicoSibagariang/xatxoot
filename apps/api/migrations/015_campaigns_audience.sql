-- 015_campaigns_audience.sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience JSONB NOT NULL DEFAULT '{"type": "all_contacts"}'::jsonb;
