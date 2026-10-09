# Checklist Teknis Fase 4: Insight, Help Center & Campaigns — Xatxoot

> **Phase 4 Implementation Roadmap & Task Breakdown**  
> Rencana kerja teknis atomik untuk modul Pelaporan & Analitik (Reports), Portal Bantuan (Help Center), Mesin Aturan Otomasi (Automation Rules), serta Kampanye & Siaran WhatsApp Massal (Broadcast) dengan Pelindung Anti-Ban.

---

## 🎯 Target Utama Fase 4
1. **Laporan & Analitik Komprehensif**:
   - Metrik kinerja: First Response Time (FRT), Resolution Time, Total Tiket, CSAT Score.
   - Breakdown analisis per Agent, per Team, per Inbox, per Label.
   - Live Dashboard metrik real-time & ekspor laporan CSV.
2. **Help Center / Knowledge Base**:
   - Manajemen Portal, Kategori, dan Artikel multi-bahasa.
   - Portal publik yang ramah SEO (SSR via Hono) untuk pencarian mandiri oleh pelanggan.
3. **Mesin Otomasi (Automation Rules Engine)**:
   - Pola *Event $\rightarrow$ Conditions $\rightarrow$ Actions* (misal: Pesan mengandung kata "Billing" $\rightarrow$ otomatis assign ke Tim Finance dan beri label "Invoice").
4. **Kampanye & WhatsApp Broadcast (dengan Anti-Ban Guard)**:
   - Kirim siaran terjadwal ke segmen kontak tertentu.
   - Khusus channel unofficial (Baileys): dilengkapi **Anti-Ban Protection Engine** (jeda waktu dinamis acak, pembatasan kuota per jam, dan random variasi spasi).

---

## 📋 Daftar Tugas Atomik (Step-by-Step)

### Bagian 1: Skema Database & Migrasi (`apps/api/migrations/005_phase4_insights.sql`)
- [ ] **Task 4.1**: Buat tabel agregasi pelaporan & event audit:
  - `reporting_events` (event_type, conversation_id, ticket_id, user_id, inbox_id, value_in_seconds, created_at).
- [ ] **Task 4.2**: Buat tabel Help Center / Portal:
  - `portals` (name, slug, custom_domain, header_text, logo_url).
  - `categories` (portal_id, name, slug, description, position).
  - `articles` (category_id, author_id, title, slug, content_markdown, status: `draft`|`published`, views_count).
- [ ] **Task 4.3**: Buat tabel Automation Rules:
  - `automation_rules` (name, event_name, conditions JSONB, actions JSONB, active).
- [ ] **Task 4.4**: Buat tabel Campaigns & Broadcast:
  - `campaigns` (inbox_id, title, message_content, scheduled_at, status: `draft`|`scheduled`|`processing`|`completed`, anti_ban_delay_min, anti_ban_delay_max).
  - `campaign_deliveries` (campaign_id, contact_id, status: `pending`|`sent`|`failed`, error_message, sent_at).

---

### Bagian 2: Shared Types & Zod Schemas (`packages/shared`)
- [ ] **Task 4.5**: Tipe & skema validasi untuk query filter metrik laporan (*date range, agent_id, inbox_id*).
- [ ] **Task 4.6**: Skema validasi artikel & kategori Help Center.
- [ ] **Task 4.7**: Definisi DSL kondisi & aksi untuk Automation Rules Engine.
- [ ] **Task 4.8**: Skema validasi pengiriman Campaign & broadcast audience selector.

---

### Bagian 3: Backend Services & Workers (`apps/api`) — Siklus TDD
- [ ] **Task 4.9 (TDD - Analytics Engine)**:
  - Listener event pencatat waktu: penanda First Response Time saat agent pertama kali membalas, dan Resolution Time saat tiket ditutup.
  - Query raw SQL agregasi harian/mingguan yang teroptimasi tanpa full-table scan.
  - Endpoint ekspor laporan ke stream CSV (`GET /api/v1/reports/export`).
- [ ] **Task 4.10 (TDD - Help Center API & Public SSR)**:
  - CRUD manajemen artikel untuk agent/admin.
  - Public SSR route `GET /portal/:slug` dan `GET /portal/:slug/articles/:article_slug` menggunakan renderer HTML Hono ultra-ringan.
- [ ] **Task 4.11 (TDD - Automation Rules Evaluator)**:
  - Evaluator kondisi berbasis JSON Logic / operator sederhana (`contains`, `equals`, `in_list`).
  - Eksekutor aksi berantai secara transaksional di database.
- [ ] **Task 4.12 (TDD - Broadcast Engine & Anti-Ban Guard)**:
  - Worker BullMQ khusus `campaign-dispatch`.
  - Anti-Ban Rate Limiter: menyuntikkan jitter/delay acak (misal: 15–45 detik per pesan) untuk pengiriman nomor WhatsApp Baileys demi mencegah pemblokiran algoritma Meta.

---

### Bagian 4: Antarmuka Web Dashboard (`apps/web`)
- [ ] **Task 4.13**: Halaman Visual Analytics: grafik performa agen, chart volume chat per jam, heatmap, dan rata-rata skor CSAT.
- [ ] **Task 4.14**: Halaman Editor Help Center: rich markdown editor untuk menulis artikel basis pengetahuan.
- [ ] **Task 4.15**: Antarmuka Builder Automation Rules: antarmuka visual pemilihan *Trigger $\rightarrow$ Filter $\rightarrow$ Action*.
- [ ] **Task 4.16**: Wizard Pembuatan Campaign: pemilih audiens, preview pesan WhatsApp, konfigurasi throttle anti-ban, dan progress bar pengiriman live.

---

### Bagian 5: Verifikasi & Quality Gate
- [ ] **Task 4.17**: Pastikan seluruh test suite lolos (`bun test`) — 100% PASS.
- [ ] **Task 4.18**: Validasi Biome linter & formatter (`bun run check`) — 0 warning.
