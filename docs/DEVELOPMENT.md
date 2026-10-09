# Panduan Pengembangan Lokal — Xatxoot

> **Local Development & Setup Guide**  
> Petunjuk instalasi dependensi, menjalankan service lokal, migrasi database, dan pengujian untuk pengembang dan AI Agent.

---

## 1. Prasyarat Sistem

Pastikan tools berikut telah terpasang di sistem operasi Anda:
- **[Bun](https://bun.sh/)** $\ge$ v1.1.0 (Runtime & Package Manager utama)
- **[Node.js](https://nodejs.org/)** LTS v20 atau v22 (Dibutuhkan khusus untuk `apps/wa-gateway`)
- **[Docker & Docker Compose](https://www.docker.com/)** (Untuk menjalankan PostgreSQL 16 & Redis 7 lokal)

---

## 2. Langkah Cepat Memulai (Quickstart)

### Langkah 1: Pasang Dependensi Monorepo
```bash
bun install
```

### Langkah 2: Nyalakan Database & Redis Lokal
```bash
docker compose -f docker-compose.dev.yml up -d
```
> Layanan yang aktif:
> - **PostgreSQL 16**: `localhost:5432` (User: `xatxoot`, Pass: `xatxoot_secret`, DB: `xatxoot_dev`)
> - **Redis 7**: `localhost:6379`

### Langkah 3: Konfigurasi Environment Variables
Salin file template `.env.example` ke `.env`:
```bash
cp .env.example .env
```

### Langkah 4: Jalankan Migrasi Database
```bash
bun run db:migrate
```

### Langkah 5: Jalankan Pengujian (TDD Verification)
```bash
bun test
```

### Langkah 6: Jalankan Server Pengembangan
```bash
bun run dev
```

---

## 3. Skrip Perintah Monorepo

| Perintah | Deskripsi |
|---|---|
| `bun install` | Memasang seluruh dependensi monorepo untuk semua workspace. |
| `bun run dev` | Menjalankan seluruh aplikasi (`api`, `web`, `wa-gateway`) secara paralel. |
| `bun test` | Menjalankan test runner bawaan Bun pada seluruh workspace. |
| `bun test <path>` | Menjalankan file test tertentu (misal: `bun test apps/api/src/modules/auth/auth.test.ts`). |
| `bun run check` | Memeriksa format dan linting kode dengan Biome (`biome check`). |
| `bun run format` | Memperbaiki format kode secara otomatis (`biome check --write`). |
| `bun run db:migrate` | Menjalankan file migrasi SQL baru ke database PostgreSQL. |

---

## 4. Variabel Lingkungan Penting (`.env`)

```ini
# PostgreSQL
DATABASE_URL=postgresql://xatxoot:xatxoot_secret@localhost:5432/xatxoot_dev

# Redis
REDIS_URL=redis://localhost:6379

# Server Ports
PORT_API=3000
PORT_GATEWAY=3001
PORT_SIMULATOR=3002
PORT_WEB=5173

# Autentikasi & Keamanan
JWT_SECRET=super_secret_jwt_key_xatxoot_dev_only
REFRESH_TOKEN_SECRET=super_secret_refresh_key_xatxoot_dev_only
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ALLOWED_DOMAINS=example.com,company.org

# Meta WhatsApp Cloud API (Opsional di Fase 0/1)
WHATSAPP_CLOUD_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_CLOUD_ACCESS_TOKEN=
WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN=xatxoot_verify_token
```
