-- Add missing fields to sso_providers to fully support OIDC & SAML metadata
ALTER TABLE sso_providers ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE sso_providers ADD COLUMN IF NOT EXISTS sso_url TEXT;
ALTER TABLE sso_providers ADD COLUMN IF NOT EXISTS saml_config JSONB;
ALTER TABLE sso_providers ADD COLUMN IF NOT EXISTS oidc_config JSONB;
