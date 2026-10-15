# Panduan Deployment & Administrator Guide — Xatxoot

> **Dokumen Resmi Panduan Produksi & Operasional Sistem**  
> Panduan ini ditujukan bagi operator self-host, DevOps engineer, dan administrator sistem untuk melakukan instalasi, konfigurasi, operasional, dan pemeliharaan instance Xatxoot di infrastruktur server / Virtual Private Server (VPS) produksi.

---

## Daftar Isi
1. [Spesifikasi Sistem & Prasyarat](#1-spesifikasi-sistem--prasyarat-system-requirements)
2. [Arsitektur Layanan & Pilihan Metode Deployment](#2-arsitektur-layanan--pilihan-metode-deployment)
3. [Langkah Instalasi Jalur A: Docker Compose (Direkomendasikan)](#3-langkah-instalasi-jalur-a-docker-compose-direkomendasikan)
4. [Langkah Instalasi Jalur B: Native Linux / Bare-Metal (Non-Docker)](#4-langkah-instalasi-jalur-b-native-linux--bare-metal-non-docker)
5. [Kamus Lengkap Variabel Lingkungan (`.env.production.example`)](#5-kamus-lengkap-variabel-lingkungan-envproductionexample)
6. [Panduan Administrator (First-time Setup & Onboarding)](#6-panduan-administrator-first-time-setup--onboarding)
7. [Konfigurasi Saluran Komunikasi (Omnichannel Inboxes)](#7-konfigurasi-saluran-komunikasi-omnichannel-inboxes)
8. [Operasional, Pemeliharaan, Backup & Pemulihan](#8-operasional-pemeliharaan-backup--pemulihan)
9. [Panduan Pemecahan Masalah (Troubleshooting & Diagnostik)](#9-panduan-pemecahan-masalah-troubleshooting--diagnostik)
10. [Panduan Pengerasan Keamanan Produksi (Security Hardening Checklist)](#10-panduan-pengerasan-keamanan-produksi-security-hardening-checklist)
11. [Prinsip Single Organization Guardrail](#11-prinsip-single-organization-guardrail)

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

## 2. Arsitektur Layanan & Pilihan Metode Deployment

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

### Matriks Perbandingan: Jalur A (Docker Compose) vs Jalur B (Native Linux)
Xatxoot mendukung dua jalur deployment resmi sesuai karakteristik infrastruktur server Anda:

| Kriteria Evaluasi | Jalur A: Docker Compose (Direkomendasikan) | Jalur B: Native Linux / Bare-Metal (Non-Docker) |
| :--- | :--- | :--- |
| **Kemudahan Instalasi** | Sangat Mudah (1 perintah `docker compose up -d`) | Menengah (instalasi paket PostgreSQL, Redis, Bun secara mandiri) |
| **Kebutuhan RAM Minimal** | 2 - 4 GB RAM | 1 - 2 GB RAM (Sangat efisien, footprint minimal) |
| **Isolasi Lingkungan** | Penuh (kontainer mandiri & jaringan bridge terisolasi) | Berbagi langsung dengan sistem operasi host |
| **Performa Kueri DB** | Standar Docker bridge network | Maksimal (koneksi Unix Domain Socket / TCP lokal langsung) |
| **Manajemen Proses** | Docker Engine & Docker daemon | Linux `systemd` daemon unit files |
| **Skenario Penggunaan** | Server VPS cloud standar, DigitalOcean, Linode, AWS | VPS berspesifikasi rendah (1 GB RAM), container LXC/OpenVZ, server fisik |

---

## 3. Langkah Instalasi Jalur A: Docker Compose (Direkomendasikan)

Ikuti langkah-langkah di bawah ini untuk meluncurkan instance Xatxoot berbasis kontainer dalam waktu kurang dari 5 menit:

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

## 4. Langkah Instalasi Jalur B: Native Linux / Bare-Metal (Non-Docker)

Jalur ini ditujukan bagi Anda yang ingin menjalankan Xatxoot langsung di atas sistem operasi Linux (Ubuntu/Debian) tanpa lapisan virtualisasi kontainer Docker untuk performa maksimal dan penggunaan RAM seminimal mungkin (ideal untuk VPS 1 - 2 GB RAM).

### Langkah 1: Persiapan Sistem & Instalasi Paket Host
Jalankan perintah berikut di terminal server:

```bash
# 1. Update paket dan pasang utilitas dasar
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw

# 2. Pasang PostgreSQL 16 & pgvector
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-16 postgresql-16-pgvector

# 3. Pasang Redis Server
sudo apt install -y redis-server
sudo systemctl enable --now redis-server

# 4. Pasang runtime Bun (untuk backend API Hono & monorepo)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 5. Pasang runtime Node.js 20 LTS (khusus microservice WhatsApp Baileys)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Langkah 2: Setup Database PostgreSQL & Ekstensi Vector
Masuk ke terminal PostgreSQL untuk membuat user, database, dan mengaktifkan ekstensi `pgvector`:

```bash
sudo -u postgres psql
```

Eksekusi kueri SQL berikut:
```sql
CREATE USER xatxoot_prod WITH PASSWORD 'GantiDenganPasswordKuat123!';
CREATE DATABASE xatxoot_prod OWNER xatxoot_prod;
\c xatxoot_prod
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### Langkah 3: Kloning Repositori & Instalasi Dependensi Monorepo
```bash
# Clone ke direktori produksi (misalnya /opt/xatxoot)
sudo git clone https://github.com/wardix/xatxoot.git /opt/xatxoot
sudo chown -R $USER:$USER /opt/xatxoot
cd /opt/xatxoot

# Pasang dependensi monorepo
bun install

# Siapkan file .env produksi
cp .env.production.example .env
nano .env
```

Pada file `.env`, sesuaikan string koneksi lokal:
```env
PORT_API=3000
PORT_GATEWAY=3001
DATABASE_URL=postgresql://xatxoot_prod:GantiDenganPasswordKuat123!@localhost:5432/xatxoot_prod
REDIS_URL=redis://localhost:6379
```

### Langkah 4: Eksekusi Migrasi Database & Kompilasi Frontend
```bash
cd /opt/xatxoot

# 1. Jalankan migrasi database otomatis
bun run db:migrate

# 2. Build dashboard web produksi (menghasilkan folder static apps/web/dist)
cd apps/web
bun run build
cd ../..
```

### Langkah 5: Konfigurasi Layanan Latar Belakang Systemd
Gunakan `systemd` agar backend API dan WhatsApp Gateway berjalan otomatis sebagai daemon latar belakang (*background daemons*):

#### A. Service Backend API (`/etc/systemd/system/xatxoot-api.service`)
Buat file service menggunakan `sudo nano /etc/systemd/system/xatxoot-api.service`:
```ini
[Unit]
Description=Xatxoot Backend API (Hono on Bun)
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=bimasakti
WorkingDirectory=/opt/xatxoot/apps/api
EnvironmentFile=/opt/xatxoot/.env
ExecStart=/home/bimasakti/.bun/bin/bun run src/index.ts
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```
> [!NOTE]
> Sesuaikan nilai `User=bimasakti` dan jalur biner `/home/bimasakti/.bun/bin/bun` dengan username dan jalur instalasi `which bun` di server Anda.

#### B. Service WhatsApp Gateway (`/etc/systemd/system/xatxoot-wa-gateway.service`)
Buat file service menggunakan `sudo nano /etc/systemd/system/xatxoot-wa-gateway.service`:
```ini
[Unit]
Description=Xatxoot WhatsApp Gateway (Baileys on Node.js)
After=network.target redis-server.service

[Service]
Type=simple
User=bimasakti
WorkingDirectory=/opt/xatxoot/apps/wa-gateway
EnvironmentFile=/opt/xatxoot/.env
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=always
RestartSec=10
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

#### C. Aktifkan & Jalankan Layanan:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now xatxoot-api
sudo systemctl enable --now xatxoot-wa-gateway

# Verifikasi status layanan
sudo systemctl status xatxoot-api
sudo systemctl status xatxoot-wa-gateway
```

### Langkah 6: Konfigurasi Reverse Proxy (Pilihan Caddy atau Nginx)

#### Opsi 1: Menggunakan Caddy (SSL/TLS Otomatis Let's Encrypt)
Pasang Caddy di server host:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Konfigurasi file `/etc/caddy/Caddyfile`:
```caddy
chat.example.com {
    encode gzip zstd

    # Rute API, WebSocket, dan Help Center ke service Hono
    reverse_proxy /api/* localhost:3000
    reverse_proxy /ws* localhost:3000
    reverse_proxy /healthz* localhost:3000
    reverse_proxy /portal* localhost:3000
    reverse_proxy /widget.js* localhost:3000

    # Sajikan Dashboard Web SPA Statis
    root * /opt/xatxoot/apps/web/dist
    file_server
    try_files {path} /index.html
}
```
Terapkan konfigurasi: `sudo systemctl reload caddy`.

#### Opsi 2: Menggunakan Nginx + Certbot
Jika server Anda sudah memiliki instalasi Nginx eksisting:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Buat file `/etc/nginx/sites-available/xatxoot`:
```nginx
server {
    server_name chat.example.com;

    root /opt/xatxoot/apps/web/dist;
    index index.html;

    # Static Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse Proxy REST API, WebSocket & Endpoints Lainnya
    location ~ ^/(api|ws|healthz|portal|widget.js) {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan situs dan pasang sertifikat SSL gratis:
```bash
sudo ln -s /etc/nginx/sites-available/xatxoot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d chat.example.com
```

### Langkah 7: Pembaruan Versi Native (Non-Docker Upgrade)
```bash
cd /opt/xatxoot
git pull origin main
bun install
bun run db:migrate
cd apps/web && bun run build && cd ../..
sudo systemctl restart xatxoot-api xatxoot-wa-gateway
```

---

## 5. Kamus Lengkap Variabel Lingkungan (`.env.production.example`)

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

## 6. Panduan Administrator (First-time Setup & Onboarding)

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

## 7. Konfigurasi Saluran Komunikasi (Omnichannel Inboxes)

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

## 8. Operasional, Pemeliharaan, Backup & Pemulihan

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

## 9. Panduan Pemecahan Masalah (Troubleshooting & Diagnostik)

Berikut adalah panduan penyelesaian untuk masalah umum yang sering dihadapi pada lingkungan produksi:

### 9.1 WhatsApp Cloud API Webhook Challenge Gagal
- **Gejala**: Portal Meta for Developers menolak pendaftaran webhook dengan pesan error *“The URL couldn't be validated”* atau status HTTP 403 / 502.
- **Penyebab**:
  1. Port 443 belum terbuka di firewall server atau sertifikat SSL/TLS domain tidak valid.
  2. Nilai `WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN` di file `.env` tidak sama persis dengan string verifikasi yang Anda masukkan di portal Meta.
- **Solusi**:
  1. Pastikan domain Anda dapat diakses publik via HTTPS browser tanpa peringatan sertifikat (*SSL handshake valid*).
  2. Uji endpoint challenge secara langsung menggunakan cURL:
     ```bash
     curl -i "https://chat.example.com/api/v1/webhooks/whatsapp-cloud?hub.mode=subscribe&hub.challenge=test1234&hub.verify_token=NILAI_VERIFY_TOKEN_ANDA"
     ```
     Jika sukses, server akan mengembalikan HTTP 200 OK dengan body string `test1234`.

### 9.2 QR Code Baileys Gateway Tidak Muncul di Dashboard
- **Gejala**: Saat mengklik *Pair New Device*, modal di dashboard web hanya memuat animasi *spinner* dan QR code tidak muncul.
- **Penyebab**:
  1. Service `wa-gateway` tidak dapat terhubung ke Redis broker atau antrean BullMQ terhambat.
  2. Izin tulis (*write permission*) pada direktori sesi WhatsApp (`WA_GATEWAY_SESSION_PATH`) ditolak oleh sistem file.
- **Solusi**:
  1. Periksa log kontainer atau service gateway:
     ```bash
     # Jalur Docker:
     docker compose logs -f wa-gateway
     # Jalur Native Linux:
     sudo journalctl -u xatxoot-wa-gateway -f
     ```
  2. Pastikan string `REDIS_URL` dapat di-ping dan port 6379 aktif:
     ```bash
     redis-cli ping
     # Output harus: PONG
     ```

### 9.3 Optimasi Memori & Kueri pgvector
- **Gejala**: PostgreSQL mengalami *high memory usage* atau *out-of-memory (OOM)* saat melakukan re-indexing embedding Help Center.
- **Solusi**:
  Sesuaikan alokasi parameter memori di konfigurasi PostgreSQL (`postgresql.conf`):
  ```ini
  shared_buffers = 1GB                  # ~25% dari total RAM host
  work_mem = 64MB                       # Memori per operasi sorting/vektor
  maintenance_work_mem = 512MB          # Diperlukan saat membangun indeks HNSW/IVFFlat
  ```
  Lalu restart PostgreSQL: `sudo systemctl restart postgresql`.

### 9.4 Koneksi Realtime WebSocket Sering Terputus
- **Gejala**: Indikator koneksi di web dashboard sering beralih antara *Connecting...* dan *Connected*, atau pesan baru lambat masuk.
- **Penyebab**: Reverse proxy Nginx atau load balancer memutus koneksi TCP idle terlalu cepat.
- **Solusi**:
  Tambahkan timeout WebSocket di konfigurasi Nginx:
  ```nginx
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
  ```

---

## 10. Panduan Pengerasan Keamanan Produksi (Security Hardening Checklist)

Sebelum meluncurkan instance ke publik, pastikan checklist keamanan berikut terpenuhi:

- [ ] **Firewall Host (UFW)**: Hanya izinkan port yang mutlak diperlukan:
  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow 22/tcp      # SSH (ganti jika menggunakan custom port)
  sudo ufw allow 80/tcp      # HTTP untuk ACME Let's Encrypt
  sudo ufw allow 443/tcp     # HTTPS publik
  sudo ufw enable
  ```
- [ ] **Isolasi Database & Redis ke Localhost**: Pastikan PostgreSQL (`listen_addresses = '127.0.0.1'`) dan Redis (`bind 127.0.0.1 -::1`) tidak terekspos langsung ke IP publik server.
- [ ] **Kunci Rahasia Produksi**: Pastikan `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, dan `SESSION_SECRET` tidak menggunakan nilai default dan telah digenerate secara kriptografis (`openssl rand -base64 64`).
- [ ] **Enkripsi Kredensial Pihak Ketiga**: Parameter `ENCRYPTION_KEY` berukuran 32-byte hex wajib disimpan aman untuk melindungi enkripsi API Key integrasi di database.
- [ ] **Pencadangan Otomatis Terjadwal**: Konfigurasikan cron job untuk backup berkala file database `pg_dump` ke penyimpanan cadangan terpisah (off-site S3 / storage eksternal).
- [ ] **Update Keamanan Rutin**: Terapkan patch keamanan sistem operasi host secara berkala: `sudo apt update && sudo apt upgrade -y`.

---

## 11. Prinsip Single Organization Guardrail

Seluruh arsitektur Xatxoot dibangun atas prinsip **Single Organization** yang ketat:
1. **Bebas Multi-Tenant Overheads**: Seluruh tabel database relasional, antarmuka JSON REST API, Zod validation schemas, maupun variabel konfigurasi tidak pernah menggunakan konsep multi-tenant (bebas dari pemisahan data per tenant).
2. **Kemandirian Penuh (Data Sovereignty)**: Seluruh database, token enkripsi, dan sesi WhatsApp tersimpan eksklusif di server Anda sendiri, menjamin kepatuhan penuh terhadap undang-undang perlindungan data pribadi (UU PDP dan GDPR).
3. **Efisiensi Kinerja**: Tanpa overhead filtering multi-tenant di setiap query SQL, query analitik dan pencarian semantik vector `article_embeddings` berjalan dengan kecepatan maksimal.
