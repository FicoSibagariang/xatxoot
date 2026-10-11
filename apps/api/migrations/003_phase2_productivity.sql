-- Phase 2: Productivity & Workflow Automation Schema
-- Task 2.1: Teams & Team Members

-- 1. teams (Agent functional teams e.g., Customer Support, Billing, Sales)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    allow_auto_assign BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. team_members (Mapping agents to teams)
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, user_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- Task 2.2: Canned Responses
-- 3. canned_responses (Canned quick replies invoked via /shortcut)
CREATE TABLE IF NOT EXISTS canned_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_code VARCHAR(100) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canned_responses_short_code ON canned_responses(short_code);

-- Task 2.3: Slash Commands
-- 4. slash_commands (External slash commands invoked via /command)
CREATE TABLE IF NOT EXISTS slash_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    endpoint_url TEXT NOT NULL,
    auth_header TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slash_commands_name ON slash_commands(name);

-- Task 2.4: Chatbot Engine
-- 5. bot_flows (Visual flow definitions and triggers)
CREATE TABLE IF NOT EXISTS bot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL DEFAULT 'conversation_opened',
    active BOOLEAN NOT NULL DEFAULT true,
    flow_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. bot_sessions (Active chatbot execution sessions per conversation)
CREATE TABLE IF NOT EXISTS bot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES bot_flows(id) ON DELETE CASCADE,
    current_node_id VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for chatbot engine
CREATE INDEX IF NOT EXISTS idx_bot_flows_active ON bot_flows(active);
CREATE INDEX IF NOT EXISTS idx_bot_flows_trigger_type ON bot_flows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_conversation_id ON bot_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_flow_id ON bot_sessions(flow_id);

-- Task 2.5: Macros & Macro Actions
-- 7. macros (Configured multi-action shortcuts)
CREATE TABLE IF NOT EXISTS macros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    visibility VARCHAR(50) NOT NULL DEFAULT 'personal',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. macro_actions (Individual action steps belonging to a macro)
CREATE TABLE IF NOT EXISTS macro_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    macro_id UUID NOT NULL REFERENCES macros(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for macros
CREATE INDEX IF NOT EXISTS idx_macros_created_by ON macros(created_by);
CREATE INDEX IF NOT EXISTS idx_macros_visibility ON macros(visibility);
CREATE INDEX IF NOT EXISTS idx_macro_actions_macro_id ON macro_actions(macro_id);
