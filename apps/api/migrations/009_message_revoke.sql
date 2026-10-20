-- Migration 009: Tambahkan dukungan revoke (soft delete) pesan WhatsApp
-- Menambahkan nilai 'deleted_by_sender' sebagai status pesan yang ditarik oleh pengirim.
-- Karena kolom status menggunakan VARCHAR (bukan PostgreSQL ENUM), tidak perlu ALTER TYPE.
-- Audit trail disimpan di kolom content_attributes (JSONB) yang sudah ada.

-- Tambahkan index untuk membantu query pesan yang telah di-revoke
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- Dokumentasi: content_attributes untuk pesan revoke akan berisi:
-- {
--   "isDeletedBySender": true,
--   "deletedAt": "<ISO 8601 timestamp>",
--   "revokedOriginalContent": "<konten asli sebelum dihapus>"
-- }
-- Status pesan akan diubah menjadi 'deleted_by_sender'.
-- Konten pesan (kolom 'content') tetap tersimpan dan TIDAK dihapus (soft revoke / audit trail).
