# Checklist Teknis Fase 2: Produktivitas & Otomasi Alur — Xatxoot

> **Phase 2 Implementation Roadmap & Task Breakdown**  
> Rencana kerja teknis atomik untuk fitur efisiensi agent: Balasan Cepat (Canned Responses), External Slash Commands, Visual Chatbot Engine, Assignment Engine (Round-Robin), Teams, Macros, dan WhatsApp Message Templates.

---

## 🎯 Target Utama Fase 2
1. **Peningkatan Produktivitas Agent**:
   - Canned responses dengan shortcut `/nama_shortcut`.
   - External slash commands (`/api/command`) yang memanggil webhook sistem pihak ketiga lalu memasukkan hasilnya ke composer chat.
   - Timer deadline per tiket (visual warning SLA sederhana).
   - Macros (eksekusi multi-aksi sekali klik: ganti status + tambah label + assign tim).
2. **Visual Flow-Based Chatbot Engine**:
   - Node graph berbasis alur: `Message`, `Question`, `Condition/Branch`, `HTTP Request`, `Handoff to Agent`, `Update Attribute`.
   - Eksekusi alur otomatis sebelum handoff ke agent manusia.
3. **Manajemen Tim & Penugasan Otomatis**:
   - Entitas `teams` dan `team_members`.
   - Engine auto-assign Round-Robin (meratakan beban tiket di antara agent yang online).
4. **WhatsApp Cloud Message Templates**:
   - Sinkronisasi template pesan yang disetujui Meta.
   - Pengiriman pesan template dengan variabel dinamis ke pelanggan di luar jendela 24 jam.

---

## 📋 Daftar Tugas Atomik (Step-by-Step)

### Bagian 1: Database & Migrasi (`apps/api/migrations/003_phase2_productivity.sql`)
- [ ] **Task 2.1**: Buat tabel `teams` dan `team_members`.
- [ ] **Task 2.2**: Buat tabel `canned_responses` (short_code, content).
- [ ] **Task 2.3**: Buat tabel `slash_commands` (name, description, endpoint_url, auth_header).
- [ ] **Task 2.4**: Buat tabel chatbot engine:
  - `bot_flows` (name, trigger_type, active, flow_definition JSONB).
  - `bot_sessions` (conversation_id, flow_id, current_node_id, context_data JSONB).
- [ ] **Task 2.5**: Buat tabel `macros` & `macro_actions`.
- [ ] **Task 2.6**: Buat tabel `whatsapp_templates` (waba_template_id, name, language, category, status, components JSONB).
- [ ] **Task 2.7**: Buat tabel `outgoing_webhooks` & riwayat log delivery.

---

### Bagian 2: Shared Types & Zod Schemas (`packages/shared`)
- [ ] **Task 2.8**: Definisi tipe & skema Zod untuk Team, Canned Response, dan Slash Command.
- [ ] **Task 2.9**: Definisi AST node & edge untuk Visual Bot Engine (MessageNode, QuestionNode, HttpNode, BranchNode, HandoffNode).
- [ ] **Task 2.10**: Skema validasi untuk Macro dan WhatsApp Message Template parameters.

---

### Bagian 3: Backend Services & API (`apps/api`) — Siklus TDD
- [ ] **Task 2.11 (TDD)**: Test suite & implementasi CRUD `teams` dan keanggotaan agent.
- [ ] **Task 2.12 (TDD)**: Test suite & implementasi `canned_responses` (pencarian instan berdasarkan prefix shortcut).
- [ ] **Task 2.13 (TDD)**: Test suite & implementasi `slash_commands`:
  - Worker yang memanggil webhook eksternal dengan timeout ketat (3 detik).
  - Sanitasi respons sebelum dimasukkan ke antarmuka agent.
- [ ] **Task 2.14 (TDD)**: Test suite & implementasi **Round-Robin Assignment Engine**:
  - Penugasan tiket baru secara bergilir ke agent berstatus `online` di inbox/team yang sesuai.
- [ ] **Task 2.15 (TDD)**: Test suite & implementasi **Flow Bot Execution Engine**:
  - State machine yang mengevaluasi input kontak terhadap node pertanyaan/pilihan.
  - Eksekusi node HTTP Request secara asinkron.
  - Node Handoff: mengubah status tiket menjadi `open` dan memicu notifikasi ke agent manusia.
- [ ] **Task 2.16 (TDD)**: Test suite & implementasi WhatsApp Cloud Template sync & outbound sender via template.

---

### Bagian 4: Antarmuka Web Dashboard (`apps/web`)
- [ ] **Task 2.17**: Integrasi popup autocomplete `/` di composer chat untuk canned responses dan slash commands.
- [ ] **Task 2.18**: Indikator timer deadline per tiket di daftar inbox (merah jika mendekati deadline).
- [ ] **Task 2.19**: Visual Flow Builder (drag-and-drop node graph canvas) di menu Pengaturan Bot.
- [ ] **Task 2.20**: Menu manajemen Tim & konfigurasi round-robin.
- [ ] **Task 2.21**: Dialog pemilih WhatsApp Message Template dengan input isian variabel dinamis.

---

### Bagian 5: Verifikasi & Quality Gate
- [ ] **Task 2.22**: Jalankan `bun test` untuk seluruh modul Fase 2 — 100% PASS.
- [ ] **Task 2.23**: Jalankan `bun run check` (Biome) — 0 error & 0 warning.
