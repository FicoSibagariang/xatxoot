# Panduan Deployment & Administrator Guide — Xatxoot

> **Dokumen Resmi Panduan Produksi & Operasional Sistem**  
> Panduan ini ditujukan bagi operator self-host, DevOps engineer, dan administrator sistem untuk melakukan instalasi, konfigurasi, operasional, dan pemeliharaan instance Xatxoot di infrastruktur server / Virtual Private Server (VPS) produksi.

---

## Daftar Isi
1. [Spesifikasi Sistem & Prasyarat](#1-spesifikasi-sistem--prasyarat-system-requirements)
2. [Arsitektur Kontainer & Orkestrasi Docker Compose](#2-arsitektur-kontainer--orkestrasi-docker-compose)
3. [Langkah Instalasi Mandiri (Quick Start Deployment)](#3-langkah-instalasi-mandiri-quick-start-deployment)
4. [Kamus Lengkap Variabel Lingkungan (`.env.production.example`)](#4-kamus-lengkap-variabel-lingkungan-envproductionexample)
5. [Panduan Administrator (First-time Setup & Onboarding)](#5-panduan-administrator-first-time-setup--onboarding)
6. [Konfigurasi Saluran Komunikasi (Omnichannel Inboxes)](#6-konfigurasi-saluran-komunikasi-omnichannel-inboxes)
7. [Operasional, Pemeliharaan, Backup & Pemulihan](#7-operasional-pemeliharaan-backup--pemulihan)
8. [Prinsip Single Organization Guardrail](#8-prinsip-single-organization-guardrail)

---

## 1. Spesifikasi Sistem & Prasyarat (System Requirements)

### Rekomendasi Spesifikasi Server (Hardware)
| Tingkat Beban | vCPU | RAM | Disk (SSD / NVMe) | Kapasitas Beban Agen & Pesan |
| :--- | :--- | :--- | :--- | :--- |
| **Minimal / Startup** | 1 - 2 vCPU | 2 - 4 GB RAM | 20 GB SSD | 1 - 10 agen aktif, hingga 10.000 pesan/hari |
| **Standar Bisnis (Rekomendasi)** | 4 vCPU | 8 GB RAM | 50 GB NVMe SSD | 10 - 50 agen aktif, hingga 100.000 pesan/hari |
| **Enterprise / Volume Tinggi** | 8+ vCPU | 16+ GB RAM | 100+ GB NVMe SSD | 50+ agen aktif, > 500.000 pesan/hari + AI pgvector intensif |

> [!NOTE]
> Node.js (untuk gateway WhatsApp Baileys) dan Bun (untuk runtime API) sangat efisien dalam penggunaan memori. Namun alokasi RAM minimal 2-4 GB sangat direkomendasikan demi menjaga kenyamanan PostgreSQL saat membangun index vector (`ivfflat` / `hnsw`) pada tabel `article_embeddings`.

### Prasyarat Perangkat Lunak
- **Sistem Operasi**: Linux berbasis Debian / Ubuntu (20.04 LTS, 22.04 LTS, 24.04 LTS) atau RHEL / AlmaLinux / Rocky Linux.
- **Docker Engine**: Versi 24.0 atau yang lebih baru.
- **Docker Compose**: Plugin Docker Compose v2 (perintah `docker compose`, bukan `docker-compose` v1 lama).
- **Domain Publik**: Domain atau subdomain aktif dengan konfigurasi DNS A-record (atau AAAA-record) yang mengarah langsung ke IP publik server Anda (misalnya: `chat.example.com`).

### Persyaratan Port Jaringan & Firewall
Pastikan port-port berikut terbuka di firewall server Anda (misalnya via `ufw` atau Security Group cloud provider):
- **Port 80 (HTTP)**: Diperlukan untuk inisiasi tantangan ACME SSL/TLS Let's Encrypt oleh Caddy.
- **Port 443 (HTTPS)**: Akses antarmuka pengguna web dashboard, WebSocket, dan penerimaan webhook eksternal (Meta, Telegram, Twilio, dll.).
- **Port Internal (Tidak Perlu Dibuka ke Publik)**:
  - Port `3000`: Backend API (`api`).
  - Port `3001`: WhatsApp Baileys Gateway (`wa-gateway`).
  - Port `5432`: PostgreSQL Database (`postgres`).
  - Port `6379`: Redis Cache & Queue (`redis`).

---

## 2. Arsitektur Kontainer & Orkestrasi Docker Compose

Xatxoot dirancang menggunakan arsitektur modular yang diisolasi ke dalam 6 komponen layanan utama:

```mermaid
flowchart TD
    Client["Klien Web / WhatsApp / Webhook Eksternal"] -->|"HTTPS / WSS (Port 80 & 443)"| Caddy["Caddy Reverse Proxy (Auto TLS Let's Encrypt)"]
    
    subgraph Cluster["Orkestrasi Kontainer Xatxoot"]
        Caddy -->|"Reverse Proxy /api & /ws"| API["api: Hono on Bun (Port 3000)"]
        Caddy -->|"Static Assets / Dashboard"| Web["web: React 19 Dashboard (Port 80)"]
        
        API -->|"Database Queries & Vector Search"| Postgres["postgres: PostgreSQL 16 + pgvector (Port 5432)"]
        API <-->|"Pub/Sub & BullMQ Jobs"| Redis["redis: Redis 7.2 Cache & Queue (Port 6379)"]
        
        Gateway["wa-gateway: Baileys Node.js 20 LTS (Port 3001)"] <-->|"Inbound / Outbound Jobs"| Redis
        Gateway -.->|"WhatsApp Socket"| WAServers["Server WhatsApp Multi-Device"]
    end
```

### Penjelasan 6 Layanan Kontainer:
1. **`api`**: Core REST API engine berbasis runtime Bun dan framework Hono. Menangani seluruh logika bisnis, otorisasi token, event emitting Server-Sent Events (SSE) / WebSocket, serta integrasi AI Copilot.
2. **`web`**: Antarmuka dashboard agen dan supervisor berbasis React 19 + Vite yang dikompilasi menjadi static assets produksi berperforma tinggi.
3. **`wa-gateway`**: Layanan konektor WhatsApp Unofficial berbasis Node.js 20 LTS dan socket Baileys Multi-Device. Berkomunikasi dengan `api` secara asinkron via Redis Pub/Sub dan antrean BullMQ.
4. **`postgres`**: Database relasional PostgreSQL 16 yang dilengkapi ekstensi `pgvector` untuk penyimpanan embedding semantik artikel Help Center.
5. **`redis`**: In-memory broker untuk sinkronisasi state realtime, antrean pengiriman broadcast anti-ban, dan pesan gateway WhatsApp.
6. **`caddy`**: Edge web server dan reverse proxy modern dengan otomatisasi penerbitan sertifikat SSL/TLS gratis dari Let's Encrypt / ZeroSSL.

---

## 3. Langkah Instalasi Mandiri (Quick Start Deployment)

Ikuti langkah-langkah di bawah ini untuk meluncurkan instance Xatxoot dalam waktu kurang dari 5 menit:

### Langkah 1: Kloning Repositori
Masuk ke server produksi Anda melalui SSH dan lakukan clone repositori:
```bash
git clone https://github.com/wardix/xatxoot.git /opt/xatxoot
cd /opt/xatxoot
```

### Langkah 2: Siapkan File Konfigurasi Lingkungan (`.env`)
Salin file template produksi ke file `.env` aktif:
```bash
cp .env.production.example .env
```

Buka file `.env` dengan editor teks (misal `nano .env`) dan sesuaikan parameter berikut:
1. `APP_URL` & `CADDY_DOMAIN`: Masukkan nama domain publik Anda (contoh: `chat.example.com`).
2. `CADDY_EMAIL`: Masukkan email Anda untuk pendaftaran sertifikat Let's Encrypt.
3. `DATABASE_URL`: Ganti password default PostgreSQL dengan password yang aman.
4. `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, & `SESSION_SECRET`: Buat string acak 64 karakter base64:
   ```bash
   openssl rand -base64 64
   ```
5. `ENCRYPTION_KEY`: Buat kunci enkripsi 32-byte hex:
   ```bash
   openssl rand -hex 32
   ```

### Langkah 3: Bangun Citra & Jalankan Kontainer (Docker Compose)
Eksekusi orkestrasi kontainer dengan perintah:
```bash
docker compose up -d --build
```

Perintah di atas akan:
- Mengunduh base image resmi (PostgreSQL 16 + pgvector, Redis, Caddy, Node.js 20, Bun).
- Melakukan multi-stage build untuk `api`, `web`, dan `wa-gateway`.
- Menjalankan migrasi skema database PostgreSQL secara otomatis (`001_init.sql` s.d. `006_phase5_advanced.sql`).
- Menerbitkan sertifikat SSL/TLS Let's Encrypt untuk domain Anda secara otomatis.

### Langkah 4: Verifikasi Status Kontainer
Pastikan seluruh 6 kontainer berjalan dalam status sehat (`healthy` / `Up`):
```bash
docker compose ps
```

---

## 4. Kamus Lengkap Variabel Lingkungan (`.env.production.example`)

Berikut adalah daftar variabel lingkungan resmi yang didukung pada sistem produksi Xatxoot:

### A. Konfigurasi Routing & Server Inti
- `NODE_ENV`: Wajib diset ke `production`.
- `APP_URL`: URL publik aplikasi dashboard web (contoh: `https://chat.example.com`).
- `API_URL`: URL endpoint REST API (contoh: `https://chat.example.com/api/v1`).
- `CADDY_DOMAIN`: Nama domain yang diarahkan ke server Caddy.
- `CADDY_EMAIL`: Email kontak administratif sertifikat SSL/TLS ACME.
- `PORT_API`: Port internal backend API (default: `3000`).
- `PORT_GATEWAY`: Port internal gateway Baileys (default: `3001`).
- `PORT_WEB`: Port internal web dashboard (default: `80`).

### B. Koneksi Database & Redis
- `DATABASE_URL`: String koneksi PostgreSQL 16. Contoh:  
  `postgresql://xatxoot_prod:password_rahasia@postgres:5432/xatxoot_prod`
- `REDIS_URL`: String koneksi Redis. Contoh:  
  `redis://redis:6379`

### C. Keamanan & Kriptografi
- `JWT_SECRET`: Kunci rahasia penandatanganan token otentikasi JWT agen.
- `REFRESH_TOKEN_SECRET`: Kunci rahasia penandatanganan refresh token.
- `SESSION_SECRET`: Kunci enkripsi sesi HTTP cookie.
- `ENCRYPTION_KEY`: Kunci AES-256 (32 byte hex) untuk mengenkripsi API Key pihak ketiga (OpenAI, Meta App Secret, SMTP Password) yang disimpan pada database.

### D. Meta WhatsApp Cloud API (Resmi)
- `WHATSAPP_CLOUD_API_URL`: URL Graph API Meta (default: `https://graph.facebook.com/v18.0`).
- `WHATSAPP_CLOUD_ACCESS_TOKEN`: System User Permanent Access Token dari Meta Business Suite.
- `WHATSAPP_CLOUD_PHONE_NUMBER_ID`: ID nomor telepon WhatsApp Cloud API.
- `WHATSAPP_CLOUD_WABA_ID`: WhatsApp Business Account ID.
- `WHATSAPP_CLOUD_APP_SECRET`: App Secret dari Meta Developer App untuk validasi tanda tangan webhook (`X-Hub-Signature-256`).
- `WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN`: Token rahasia custom untuk verifikasi awal webhook Meta (`hub.verify_token`).

### E. WhatsApp Gateway Unofficial (Baileys)
- `WA_GATEWAY_REDIS_PREFIX`: Prefix namespace Redis (default: `xatxoot:wa:`).
- `WA_GATEWAY_RECONNECT_INTERVAL`: Jeda waktu rekoneksi socket otomatis dalam milidetik (default: `5000`).
- `WA_GATEWAY_SESSION_PATH`: Jalur penyimpanan file kredensial autentikasi WhatsApp (default: `/data/baileys_auth`).
- `WA_GATEWAY_QR_EXPIRY_SECONDS`: Waktu kedaluwarsa kode QR sebelum refresh (default: `60`).

### F. Autentikasi Google OAuth & Enterprise SSO
- `GOOGLE_CLIENT_ID`: OAuth 2.0 Client ID dari Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: OAuth 2.0 Client Secret dari Google Cloud Console.
- `GOOGLE_CALLBACK_URL`: URL callback OAuth (contoh: `https://chat.example.com/api/v1/auth/google/callback`).
- `GOOGLE_ALLOWED_DOMAINS`: Pembatasan domain email login Google (pisahkan dengan koma, misal: `perusahaan.com,holding.org`). Biarkan kosong untuk mengizinkan semua domain.
- **Enterprise SAML 2.0 Metadata URL**: `https://chat.example.com/api/v1/sso/saml/metadata`.
- **Enterprise SAML 2.0 ACS Callback**: `https://chat.example.com/api/v1/sso/saml/acs`.
- **Enterprise OIDC Callback**: `https://chat.example.com/api/v1/sso/oidc/callback`.

### G. Kecerdasan Buatan (AI Copilot & pgvector Semantic Search)
- `OPENAI_API_KEY`: Kunci API OpenAI untuk model ringkasan pesan (*Summarization*), perbaikan nada bicara (*Tone Adjustment*), dan draf balasan (*RAG Draft*).
- `OPENAI_MODEL`: Model bahasa OpenAI yang digunakan (default: `gpt-4o`).
- `OPENAI_EMBEDDING_MODEL`: Model vector embedding Help Center (default: `text-embedding-3-small` / 1536 dimensi).
- `GEMINI_API_KEY`: Kunci API Google Gemini (opsional).
- `ANTHROPIC_API_KEY`: Kunci API Anthropic Claude (opsional).
- `OLLAMA_BASE_URL`: URL instance Ollama lokal (opsional, contoh: `http://localhost:11434`).

### H. Saluran Omnichannel Tambahan
- **Email (SMTP & IMAP)**:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`: Kredensial server SMTP pengiriman balasan tiket & notifikasi.
  - `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`: Kredensial server IMAP penarik email masuk pelanggan menjadi tiket otomatis.
- **Telegram Bot**:
  - `TELEGRAM_BOT_TOKEN`: Token bot dari @BotFather.
  - `TELEGRAM_WEBHOOK_URL`: `https://chat.example.com/api/v1/webhooks/telegram`.
- **Twilio SMS**:
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
- **Meta Social (Facebook & Instagram)**:
  - `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`.

---

## 5. Panduan Administrator (First-time Setup & Onboarding)

### Inisialisasi Akun Pertama (Setup Wizard: `/setup`)
Saat instance baru pertama kali diluncurkan, sistem belum memiliki akun dan profil organisasi:
1. Buka peramban (browser) dan akses halaman: `https://chat.example.com/setup`.
2. Halaman wizard inisialisasi akan memandu Anda membuat:
   - **Profil Organisasi (Single Organization)**: Nama perusahaan, logo, timezone (default: `Asia/Jakarta`), dan bahasa sistem.
   - **Akun Super Admin (Owner)**: Nama lengkap, alamat email administratif, dan password kuat (dihash menggunakan Argon2id).
3. Setelah formulir setup disimpan, rute `/setup` akan **terkunci permanen secara otomatis** demi keamanan agar tidak dapat dijalankan ulang.

### Konfigurasi Organisasi Singleton
Xatxoot menganut prinsip arsitektur **Single Organization** (satu instalasi untuk satu entitas bisnis). Seluruh pengaturan global, logo perusahaan, zona waktu operasional, dan webhook terpusat pada tabel singleton `organizations`.

### Manajemen Tim & Peran Pengguna (RBAC)
Administrator dapat mengundang dan mengatur izin anggota tim melalui menu **Settings > Team Management**:
1. **Peran Bawaan (Default Roles)**:
   - **Owner / Administrator**: Akses penuh ke seluruh konfigurasi sistem, billing, channel, dan audit log.
   - **Supervisor**: Dapat memantau seluruh antrean tiket, SLA real-time, statistik agen, dan mengalokasikan ulang penugasan.
   - **Agent**: Menangani tiket dan percakapan pelanggan yang ditugaskan ke dirinya atau timnya.
2. **Peran Kustom Granular (Custom Roles)**:
   - Memungkinkan pembatasan hak khusus, misalnya agen hanya boleh membaca pesan tanpa hak mengekspor data kontak, atau agen tidak boleh menghapus draf balasan.
3. **Kebijakan Kapasitas Beban Agen (Capacity Policy Engine)**:
   - Tetapkan batas maksimal tiket aktif bersamaan per agen (contoh: maksimal 10 tiket per agent) untuk mencegah kejenuhan agen dan menjaga respon SLA tetap optimal.

---

## 6. Konfigurasi Saluran Komunikasi (Omnichannel Inboxes)

Masuk ke menu **Settings > Inboxes > Add Inbox** untuk menghubungkan berbagai saluran:

### A. WhatsApp Cloud API (Resmi)
1. Buat aplikasi di [Meta for Developers](https://developers.facebook.com/) dengan tipe *Business*.
2. Tambahkan produk *WhatsApp* dan dapatkan *Permanent System User Access Token* serta *Phone Number ID*.
3. Pada dashboard Xatxoot, pilih saluran WhatsApp Cloud API dan masukkan kredensial tersebut.
4. Salin URL Webhook dari Xatxoot: `https://chat.example.com/api/v1/webhooks/whatsapp-cloud` dan Verify Token ke portal Meta.
5. Berlangganan (subscribe) ke event webhook: `messages` dan `message_deliveries`.

### B. WhatsApp Unofficial Gateway (Baileys QR Code)
1. Pada menu Inboxes, pilih opsi *WhatsApp Web / Baileys*.
2. Klik tombol **Pair New Device**. Modal kode QR interaktif akan muncul di layar.
3. Buka aplikasi WhatsApp di ponsel operasional Anda, masuk ke **Linked Devices (Perangkat Tertaut) > Link a Device**, lalu pindai kode QR yang tampil di layar.
4. Status akan berubah menjadi `connected` secara instan, dan nomor telepon yang terhubung akan tersimpan.

### C. Live Chat Widget Website
1. Pada menu Inboxes, pilih *Live Chat Widget*.
2. Sesuaikan warna tema (primary color), pesan sambutan selamat datang, dan logo.
3. Salin kode snippet JavaScript yang disediakan ke bagian akhir tag `<body>` website publik Anda:
   ```html
   <script
     src="https://chat.example.com/widget.js"
     data-inbox-id="UUID-INBOX-ANDA"
     defer>
   </script>
   ```

### D. Saluran Tambahan (Email, Telegram, Meta Social, Twilio)
- **Email**: Masukkan kredensial IMAP untuk mendengarkan pesan masuk dan SMTP untuk membalas email pelanggan dalam bentuk thread tiket.
- **Telegram**: Buat bot baru di Telegram melalui `@BotFather`, salin token bot, dan sistem Xatxoot akan mendaftarkan webhook Telegram secara otomatis.
- **Meta Social**: Hubungkan Facebook Page Access Token & Instagram Professional Account untuk mengelola pesan DM di inbox terpadu.
- **Twilio SMS**: Masukkan Twilio Account SID, Auth Token, dan nomor telepon virtual untuk pengiriman dan penerimaan pesan SMS dua arah.

---

## 7. Operasional, Pemeliharaan, Backup & Pemulihan

### Prosedur Backup Database PostgreSQL
Lakukan backup data secara berkala menggunakan utilitas `pg_dump`:

```bash
# Membuat cadangan data terkompresi dengan timestamp
docker compose exec -T postgres pg_dump -U xatxoot_prod -d xatxoot_prod | gzip > /opt/backups/xatxoot_$(date +%Y%m%d_%H%M%S).sql.gz
```

> [!TIP]
> Buat cron job di server host untuk menjalankan pencadangan otomatis setiap malam pada pukul 02:00:
> `0 2 * * * docker compose -f /opt/xatxoot/docker-compose.yml exec -T postgres pg_dump -U xatxoot_prod -d xatxoot_prod | gzip > /opt/backups/xatxoot_$(date +\%F).sql.gz`

### Prosedur Restore Database
Untuk memulihkan database dari arsip cadangan:
```bash
# Pastikan kontainer postgres aktif
gunzip < /opt/backups/xatxoot_20261014.sql.gz | docker compose exec -T postgres psql -U xatxoot_prod -d xatxoot_prod
```

### Pemantauan Log Kontainer (Logging)
Pantau log realtime seluruh layanan atau per kontainer spesifik:
```bash
# Log seluruh layanan
docker compose logs -f

# Log khusus backend API
docker compose logs -f api

# Log koneksi socket WhatsApp Baileys
docker compose logs -f wa-gateway
```

### Pemeriksaan Kesehatan Sistem (Healthcheck)
Xatxoot menyediakan endpoint healthcheck terstandarisasi untuk integrasi dengan load balancer atau monitoring eksternal (UptimeRobot, Prometheus, Datadog):
- **Healthcheck URL**: `https://chat.example.com/healthz` atau `https://chat.example.com/api/v1/healthz`
- **Output JSON Sehat**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-14T02:30:00.000Z",
    "database": "connected",
    "redis": "connected",
    "version": "1.0.0"
  }
  ```

### Prosedur Update & Upgrade Instance Xatxoot
Untuk memperbarui instance Xatxoot ke versi rilis terbaru:
```bash
cd /opt/xatxoot

# 1. Ambil commit terbaru dari repositori
git pull origin main

# 2. Rebuild citra kontainer dengan dependensi terbaru
docker compose build

# 3. Restart layanan (zero-downtime rolling restart jika menggunakan Caddy)
docker compose up -d

# 4. Verifikasi migrasi skema database berjalan sukses
docker compose logs api | grep "migration"
```

---

## 8. Prinsip Single Organization Guardrail

Seluruh arsitektur Xatxoot dibangun atas prinsip **Single Organization** yang ketat:
1. **Bebas Multi-Tenant Overheads**: Seluruh tabel database relasional, antarmuka JSON REST API, Zod validation schemas, maupun variabel konfigurasi tidak pernah menggunakan konsep multi-tenant (bebas dari pemisahan data per tenant).
2. **Kemandirian Penuh (Data Sovereignty)**: Seluruh database, token enkripsi, dan sesi WhatsApp tersimpan eksklusif di server Anda sendiri, menjamin kepatuhan penuh terhadap undang-undang perlindungan data pribadi (UU PDP dan GDPR).
3. **Efisiensi Kinerja**: Tanpa overhead filtering multi-tenant di setiap query SQL, query analitik dan pencarian semantik vector `article_embeddings` berjalan dengan kecepatan maksimal.
