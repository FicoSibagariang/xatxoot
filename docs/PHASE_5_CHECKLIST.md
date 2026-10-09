# Checklist Teknis Fase 5: AI Copilot & Fitur Tingkat Lanjut — Xatxoot

> **Phase 5 Implementation Roadmap & Task Breakdown**  
> Rencana kerja teknis atomik untuk modul kecerdasan buatan (AI Assistant & Copilot), Mesin SLA, Custom Roles & Kebijakan Kapasitas, Enterprise SSO (SAML/OIDC), dan Audit Log Kepatuhan.

---

## 🎯 Target Utama Fase 5
1. **AI Assistant & Copilot (BYO-Key & pgvector)**:
   - Dukungan Bring-Your-Own-Key (OpenAI, Google Gemini, Anthropic, atau Ollama lokal).
   - Ekstensi `pgvector` di PostgreSQL untuk pencarian semantik artikel Help Center.
   - Fitur Copilot di composer agent: Ringkas obrolan (*Summarize*), Perbaiki nada bahasa (*Change tone*), dan Draf balasan otomatis berbasis artikel (*RAG Auto-Draft*).
2. **Mesin Service Level Agreement (SLA)**:
   - Target waktu First Response & Waktu Selesai berdasarkan prioritas tiket (`urgent`, `high`, `medium`, `low`).
   - Peringatan visual & eskalasi otomatis sebelum pelanggaran SLA (*SLA breach*).
3. **Keamanan & Tata Kelola Enterprise**:
   - Single Sign-On Enterprise: SAML 2.0 & OIDC.
   - Kebijakan Kapasitas Beban Agen (*Agent Capacity Policy*).
   - Peran Kustom Granular (*Custom Roles & Permissions*).
   - Audit Log menyeluruh untuk kepatuhan perlindungan data (UU PDP / GDPR).

---

## 📋 Daftar Tugas Atomik (Step-by-Step)

### Bagian 1: Skema Database & Migrasi (`apps/api/migrations/006_phase5_advanced.sql`)
- [ ] **Task 5.1**: Aktifkan ekstensi `CREATE EXTENSION IF NOT EXISTS vector;`.
- [ ] **Task 5.2**: Buat tabel vector embeddings untuk basis pengetahuan:
  - `article_embeddings` (article_id, chunk_text, embedding vector(1536 atau 768)).
- [ ] **Task 5.3**: Buat tabel konfigurasi AI provider:
  - `ai_settings` (provider: `openai`|`gemini`|`anthropic`|`ollama`, api_key_encrypted, model_name, temperature, active).
- [ ] **Task 5.4**: Buat tabel SLA:
  - `sla_policies` (name, inbox_id, first_response_time_seconds, resolution_time_seconds).
  - `ticket_sla_statuses` (ticket_id, policy_id, first_response_deadline, resolution_deadline, is_breached).
- [ ] **Task 5.5**: Buat tabel konfigurasi SSO Enterprise:
  - `sso_providers` (provider_type: `saml`|`oidc`, issuer_url, client_id, client_secret_encrypted, cert_data).

---

### Bagian 2: Shared Types & Zod Schemas (`packages/shared`)
- [ ] **Task 5.6**: Tipe & skema validasi konfigurasi AI Provider & Copilot action requests.
- [ ] **Task 5.7**: Skema validasi aturan SLA Policy per tingkat prioritas.
- [ ] **Task 5.8**: Skema validasi konfigurasi metadata SAML/OIDC.

---

### Bagian 3: Backend Services (`apps/api`) — Siklus TDD
- [ ] **Task 5.9 (TDD - Vector & RAG Search Engine)**:
  - Worker pembuat chunk teks & generate embedding saat artikel Help Center dipublikasikan.
  - Query pencarian similaritas kosinus (`<=>`) native PostgreSQL pgvector.
- [ ] **Task 5.10 (TDD - AI Copilot Services)**:
  - Layanan *Summarization*: menghasilkan ringkasan percakapan panjang untuk diinjeksi ke *Sticky Internal Note*.
  - Layanan *Tone Adjustment*: mengubah draf chat menjadi lebih sopan (*polite*), ringkas (*concise*), atau formal.
  - Layanan *RAG Suggestion*: menyusun usulan balasan berdasarkan artikel rujukan yang relevan.
- [ ] **Task 5.11 (TDD - SLA Monitoring Worker)**:
  - Cron / recurring queue worker pengecek tiket yang mendekati deadline SLA.
  - Broadcast peringatan SSE & trigger webhook notifikasi saat terjadi pelanggaran (*SLA breach*).
- [ ] **Task 5.12 (TDD - SAML & OIDC Handler)**:
  - Endpoint pemrosesan assertion SAML dan redirect OAuth OIDC.
- [ ] **Task 5.13 (TDD - Capacity Policy Engine)**:
  - Membatasi penugasan tiket baru jika agent telah mencapai batas kapasitas maksimum (misal: 10 tiket aktif per agent).

---

### Bagian 4: Antarmuka Web Dashboard (`apps/web`)
- [ ] **Task 5.14**: Toolbar AI Copilot di composer chat (tombol Magic: *Ringkas*, *Perbaiki Bahasa*, *Buat Draf*).
- [ ] **Task 5.15**: Panel konfigurasi AI Provider (pengaturan kunci API, tes koneksi prompt, dan sinkronisasi embedding).
- [ ] **Task 5.16**: Visual Badge SLA pada kartu tiket (hitung mundur sisa waktu sebelum breach).
- [ ] **Task 5.17**: Halaman Pengaturan Keamanan Enterprise (SAML/OIDC SSO Setup dan tabel Audit Log aktivitas).

---

### Bagian 5: Verifikasi & Quality Gate
- [ ] **Task 5.18**: Eksekusi seluruh pengujian menyeluruh monorepo (`bun test`) — 100% PASS.
- [ ] **Task 5.19**: Pemeriksaan akhir kode dengan Biome (`bun run check`) — 0 warning/error.
