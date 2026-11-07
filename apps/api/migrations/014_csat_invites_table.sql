-- 014_csat_invites_table.sql
CREATE TABLE IF NOT EXISTS csat_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE UNIQUE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    inbox_id UUID REFERENCES inboxes(id) ON DELETE SET NULL,
    token VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    invite_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csat_invites_token ON csat_invites(token);
CREATE INDEX IF NOT EXISTS idx_csat_invites_ticket_id ON csat_invites(ticket_id);

ALTER TABLE csat_surveys ALTER COLUMN contact_id DROP NOT NULL;
