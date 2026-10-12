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

-- Task 4.2: Help Center / Knowledge Base Tables (Portals, Categories, Articles)

-- 2. portals
CREATE TABLE IF NOT EXISTS portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    custom_domain VARCHAR(255),
    header_text TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. portal_categories
CREATE TABLE IF NOT EXISTS portal_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. portal_articles
CREATE TABLE IF NOT EXISTS portal_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES portal_categories(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    content_markdown TEXT NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    views_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updatable views for schema flexibility and domain terminology mapping
CREATE OR REPLACE VIEW categories AS SELECT * FROM portal_categories;
CREATE OR REPLACE VIEW articles AS SELECT * FROM portal_articles;

-- Performance indexes for Help Center portal, category, and article lookups
CREATE INDEX IF NOT EXISTS idx_portals_slug ON portals(slug);
CREATE INDEX IF NOT EXISTS idx_portals_custom_domain ON portals(custom_domain);
CREATE INDEX IF NOT EXISTS idx_portal_categories_portal_id ON portal_categories(portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_categories_slug ON portal_categories(slug);
CREATE INDEX IF NOT EXISTS idx_portal_categories_position ON portal_categories(position);
CREATE INDEX IF NOT EXISTS idx_portal_articles_category_id ON portal_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_portal_articles_author_id ON portal_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_portal_articles_slug ON portal_articles(slug);
CREATE INDEX IF NOT EXISTS idx_portal_articles_status ON portal_articles(status);

-- Task 4.3: Automation Rules Table

-- 5. automation_rules
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for automation rules evaluation
CREATE INDEX IF NOT EXISTS idx_automation_rules_event_name ON automation_rules(event_name);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(active);

