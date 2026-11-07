-- Add missing fields to sla_policies and ticket_sla_statuses to support priorities and business hours
DO $$
BEGIN
  ALTER TABLE sla_policies ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE sla_policies ADD COLUMN IF NOT EXISTS priority_rules JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE sla_policies ADD COLUMN IF NOT EXISTS only_during_business_hours BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE ticket_sla_statuses ADD COLUMN IF NOT EXISTS breached_at TIMESTAMPTZ;
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
