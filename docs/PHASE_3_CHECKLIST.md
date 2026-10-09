# Checklist Teknis Fase 3: Omnichannel & CSAT — Xatxoot

> **Phase 3 Implementation Roadmap & Task Breakdown**  
> Rencana kerja teknis atomik untuk ekspansi saluran komunikasi: Email (IMAP/SMTP), Telegram Bot, Facebook Messenger, Instagram Direct, SMS/Twilio, Jam Kerja (Business Hours), dan Survei Kepuasan Pelanggan (CSAT).

---

## 🎯 Target Utama Fase 3
1. **Ekspansi Channel Omnichannel**:
   - **Email**: Dukungan penerimaan (IMAP / Inbound Webhook) & pengiriman (SMTP) lengkap dengan parsing kutipan email (*email threading & quote strip*).
   - **Telegram**: Integrasi Telegram Bot API resmi (webhook & media support).
   - **Facebook Messenger & Instagram Direct**: Integrasi Meta Graph API messaging.
   - **SMS**: Integrasi Twilio SMS atau HTTP provider lokal.
2. **Pengaturan Jam Kerja (Business Hours)**:
   - Jam operasional per Inbox (misal: Senin–Jumat 08:00–17:00).
   - Pesan balasan otomatis di luar jam kerja (*Out-of-Office auto-reply*).
3. **Survei Kepuasan Pelanggan (CSAT)**:
   - Pengiriman otomatis tautan/pesan survei rating (1–5 bintang atau emoji) begitu tiket berstatus `resolved`.
   - Perhitungan skor CSAT rata-rata per agent dan inbox.

---

## 📋 Daftar Tugas Atomik (Step-by-Step)

### Bagian 1: Skema Database & Migrasi (`apps/api/migrations/004_phase3_omnichannel.sql`)
- [ ] **Task 3.1**: Buat tabel channel baru:
  - `channels_email` (imap_host, imap_port, imap_username, imap_password_encrypted, smtp_host, smtp_port, smtp_username, smtp_password_encrypted).
  - `channels_telegram` (bot_token_encrypted, bot_username).
  - `channels_facebook` (page_id, page_access_token_encrypted).
  - `channels_instagram` (ig_user_id, ig_access_token_encrypted).
  - `channels_sms` (provider_name, account_sid, auth_token_encrypted, from_phone_number).
- [ ] **Task 3.2**: Buat tabel konfigurasi jam kerja:
  - `business_hours` (inbox_id, timezone, weekly_schedule JSONB, out_of_office_message).
- [ ] **Task 3.3**: Buat tabel survei kepuasan pelanggan:
  - `csat_surveys` (ticket_id, contact_id, rating: 1-5, feedback_text, submitted_at).

---

### Bagian 2: Shared Types & Zod Schemas (`packages/shared`)
- [ ] **Task 3.4**: Skema validasi konfigurasi masing-masing channel (Email, Telegram, FB, IG, SMS).
- [ ] **Task 3.5**: Skema validasi struktur jam kerja mingguan (*day of week, open time, close time*).
- [ ] **Task 3.6**: Skema validasi input tanggapan CSAT survey.

---

### Bagian 3: Backend Services & Adapters (`apps/api`) — Siklus TDD
- [ ] **Task 3.7 (TDD - Email)**:
  - Parser email inbound: ekstraksi plain text/HTML dan pembuangan reply quote header.
  - Pengiriman outbound via Nodemailer/SMTP dengan *In-Reply-To* dan *References* header demi menjaga email thread.
- [ ] **Task 3.8 (TDD - Telegram)**:
  - Webhook receiver update Telegram (`message`, `callback_query`).
  - Pengiriman pesan outbound & upload attachment file ke Telegram Bot API.
- [ ] **Task 3.9 (TDD - Meta Social: FB & IG)**:
  - Receiver webhook pesan masuk & pengiriman balasan ke Graph API.
- [ ] **Task 3.10 (TDD - SMS)**:
  - Integrasi Twilio webhook & outbound SMS sender.
- [ ] **Task 3.11 (TDD - Business Hours Engine)**:
  - Evaluasi waktu saat pesan masuk terhadap jam operasional inbox.
  - Pengiriman otomatis *out-of-office reply* (hanya sekali per percakapan dalam jeda 24 jam).
- [ ] **Task 3.12 (TDD - CSAT Engine)**:
  - Trigger pembuatan CSAT invite saat tiket diubah statusnya menjadi `resolved`.
  - Endpoint publik penerimaan submit rating CSAT (`POST /api/v1/csat/:ticket_token`).

---

### Bagian 4: Antarmuka Web Dashboard & Portal (`apps/web`)
- [ ] **Task 3.13**: Halaman konfigurasi penambahan channel baru (Wizard Email, Telegram, FB/IG, Twilio).
- [ ] **Task 3.14**: UI pemilih jadwal Jam Kerja per Inbox (picker hari & jam, input pesan di luar jam kantor).
- [ ] **Task 3.15**: Widget / Halaman responsif publik pengisian rating CSAT untuk pelanggan.
- [ ] **Task 3.16**: Widget tampilan rating kepuasan CSAT di drawer detail tiket.

---

### Bagian 5: Verifikasi & Quality Gate
- [ ] **Task 3.17**: Jalankan seluruh test suite (`bun test`) — 100% PASS.
- [ ] **Task 3.18**: Jalankan pemeriksaan linter & formatter (`bun run check`) — 0 issue.
