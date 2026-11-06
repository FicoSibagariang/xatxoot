-- Migration 010: Composite index untuk reverse cursor-based pagination riwayat pesan
-- Mengoptimalkan pengambilan pesan terbaru (ORDER BY created_at DESC, id DESC) pada room chat panjang.

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_desc 
ON messages (conversation_id, created_at DESC, id DESC);
