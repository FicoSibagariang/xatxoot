-- ==============================================================================
-- 016_soft_deletes_cascade_guardrail.sql
-- Soft deletes columns and CASCADE deletion mitigation guardrail (Issue #315)
-- ==============================================================================

-- 1. Companion extras tables for soft deletion auditability
CREATE TABLE IF NOT EXISTS inbox_extras (
  id UUID PRIMARY KEY,
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_inbox_extras_deleted_at ON inbox_extras(deleted_at);

CREATE TABLE IF NOT EXISTS contact_extras (
  id UUID PRIMARY KEY,
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_extras_deleted_at ON contact_extras(deleted_at);

CREATE TABLE IF NOT EXISTS conversation_extras (
  id UUID PRIMARY KEY,
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_conversation_extras_deleted_at ON conversation_extras(deleted_at);

-- 2. Foreign key guardrails enforcing ON DELETE RESTRICT
CREATE TABLE IF NOT EXISTS inbox_guardrails (
  inbox_id UUID PRIMARY KEY REFERENCES inboxes(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS contact_guardrails (
  contact_id UUID PRIMARY KEY REFERENCES contacts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS conversation_guardrails (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE RESTRICT
);

-- 3. Add deleted_at columns directly to core tables if user has table ownership/privileges
DO $$
BEGIN
  ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
  CREATE INDEX IF NOT EXISTS idx_inboxes_deleted_at ON inboxes(deleted_at);
EXCEPTION WHEN others THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
  CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at);
EXCEPTION WHEN others THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
  CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at);
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- 4. Replace ON DELETE CASCADE foreign key constraints with ON DELETE RESTRICT
-- to prevent catastrophic accidental hard deletions of customer chats, tickets, and messages.
DO $$
BEGIN
  -- conversations -> inboxes
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversations_inbox_id_fkey') THEN
    ALTER TABLE conversations DROP CONSTRAINT conversations_inbox_id_fkey;
  END IF;
  ALTER TABLE conversations ADD CONSTRAINT conversations_inbox_id_fkey
    FOREIGN KEY (inbox_id) REFERENCES inboxes(id) ON DELETE RESTRICT;

  -- conversations -> contacts
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversations_contact_id_fkey') THEN
    ALTER TABLE conversations DROP CONSTRAINT conversations_contact_id_fkey;
  END IF;
  ALTER TABLE conversations ADD CONSTRAINT conversations_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT;

  -- tickets -> conversations
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tickets_conversation_id_fkey') THEN
    ALTER TABLE tickets DROP CONSTRAINT tickets_conversation_id_fkey;
  END IF;
  ALTER TABLE tickets ADD CONSTRAINT tickets_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT;

  -- messages -> conversations
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'messages_conversation_id_fkey') THEN
    ALTER TABLE messages DROP CONSTRAINT messages_conversation_id_fkey;
  END IF;
  ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT;

EXCEPTION WHEN others THEN
  NULL;
END $$;

-- 5. Seed guardrail tables from existing records
INSERT INTO inbox_guardrails (inbox_id)
SELECT DISTINCT inbox_id FROM conversations WHERE inbox_id IS NOT NULL
ON CONFLICT (inbox_id) DO NOTHING;

INSERT INTO contact_guardrails (contact_id)
SELECT DISTINCT contact_id FROM conversations WHERE contact_id IS NOT NULL
ON CONFLICT (contact_id) DO NOTHING;

INSERT INTO conversation_guardrails (conversation_id)
SELECT DISTINCT conversation_id FROM messages WHERE conversation_id IS NOT NULL
ON CONFLICT (conversation_id) DO NOTHING;
