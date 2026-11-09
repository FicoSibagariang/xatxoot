-- ==============================================================================
-- 016_soft_deletes_cascade_guardrail.sql
-- Soft deletes columns and CASCADE deletion mitigation guardrail (Issue #315)
-- ==============================================================================

-- 1. Add deleted_at columns for soft-deletion auditability
ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 2. Indexes for efficient filtering of non-deleted records
CREATE INDEX IF NOT EXISTS idx_inboxes_deleted_at ON inboxes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at);

-- 3. Replace ON DELETE CASCADE foreign key constraints with ON DELETE RESTRICT
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
