-- Phase 5: AI Copilot, SLA, & Enterprise Migration
-- Task 5.1: Vector Extension for Knowledge Base Embeddings & Semantic Search

CREATE EXTENSION IF NOT EXISTS vector;

-- Task 5.2: Knowledge Base Vector Embeddings Table
CREATE TABLE IF NOT EXISTS article_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES portal_articles(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance index for article lookup
CREATE INDEX IF NOT EXISTS idx_article_embeddings_article_id ON article_embeddings(article_id);

-- Task 5.3: AI Provider Configuration Settings Table
CREATE TABLE IF NOT EXISTS ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    api_key_encrypted TEXT,
    api_key_enc TEXT,
    model_name VARCHAR(100) NOT NULL,
    temperature NUMERIC(3, 2) NOT NULL DEFAULT 0.70,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for AI provider settings
CREATE INDEX IF NOT EXISTS idx_ai_settings_provider ON ai_settings(provider);
CREATE INDEX IF NOT EXISTS idx_ai_settings_active ON ai_settings(active);

-- Task 5.4: SLA Policies and Ticket SLA Statuses Tables
CREATE TABLE IF NOT EXISTS sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    inbox_id UUID REFERENCES inboxes(id) ON DELETE SET NULL,
    first_response_time_seconds INT NOT NULL,
    resolution_time_seconds INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_inbox_id ON sla_policies(inbox_id);

CREATE TABLE IF NOT EXISTS ticket_sla_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
    first_response_deadline TIMESTAMPTZ,
    resolution_deadline TIMESTAMPTZ,
    is_breached BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_sla_statuses_ticket_id ON ticket_sla_statuses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_statuses_policy_id ON ticket_sla_statuses(policy_id);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_statuses_is_breached ON ticket_sla_statuses(is_breached);
