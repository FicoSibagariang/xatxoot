-- Create capacity_policies and agent_capacity_overrides tables
CREATE TABLE IF NOT EXISTS capacity_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_active_tickets INT NOT NULL,
    inbox_id UUID REFERENCES inboxes(id) ON DELETE SET NULL,
    exclude_snoozed BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_capacity_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_active_tickets INT,
    on_leave BOOLEAN NOT NULL DEFAULT false,
    leave_reason TEXT,
    leave_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_capacity_policies_inbox_id ON capacity_policies(inbox_id);
CREATE INDEX IF NOT EXISTS idx_agent_capacity_overrides_user_id ON agent_capacity_overrides(user_id);
