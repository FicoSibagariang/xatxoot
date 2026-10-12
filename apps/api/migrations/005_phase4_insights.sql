-- Phase 4: Insight, Help Center & Campaigns Migration
-- Task 4.1: Reporting Events & Audit Table for Analytics Engine

-- 1. reporting_events
CREATE TABLE IF NOT EXISTS reporting_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    inbox_id UUID REFERENCES inboxes(id) ON DELETE SET NULL,
    value_in_seconds INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for analytics aggregation and time-range filtering
CREATE INDEX IF NOT EXISTS idx_reporting_events_event_type ON reporting_events(event_type);
CREATE INDEX IF NOT EXISTS idx_reporting_events_created_at ON reporting_events(created_at);
CREATE INDEX IF NOT EXISTS idx_reporting_events_inbox_id ON reporting_events(inbox_id);
CREATE INDEX IF NOT EXISTS idx_reporting_events_user_id ON reporting_events(user_id);
CREATE INDEX IF NOT EXISTS idx_reporting_events_ticket_id ON reporting_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_reporting_events_conversation_id ON reporting_events(conversation_id);
