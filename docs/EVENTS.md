# Kontrak Event & Antrean — Xatxoot

> **Event Bus & Message Queue Specification**  
> Dokumen ini adalah kontrak resmi pertukaran data asinkron antara **`apps/wa-gateway`**, **`apps/api`**, dan **`apps/web`** melalui **Redis Pub/Sub**, **BullMQ**, dan **Server-Sent Events (SSE)**.

---

## 1. Arsitektur Komunikasi Asinkron

```mermaid
flowchart LR
    GW["apps/wa-gateway\n(Node.js Baileys)"]
    REDIS_PUB[("Redis Pub/Sub\n(Realtime Inbound)")]
    REDIS_QUEUE[("BullMQ Queue\n(Outbound Jobs)")]
    API["apps/api\n(Hono on Bun)"]
    SSE["SSE / WebSocket\n(apps/web)"]

    GW -->|"1. Event Pesan & Status QR"| REDIS_PUB
    REDIS_PUB -->|"2. Tangkap Event"| API
    API -->|"3. Dorong Job Kirim Pesan"| REDIS_QUEUE
    REDIS_QUEUE -->|"4. Ambil & Eksekusi Job"| GW
    API -->|"5. Broadcast ke Frontend"| SSE


---

## 2. Saluran Redis Pub/Sub (`apps/wa-gateway` $\rightarrow$ `apps/api`)

Digunakan untuk event berkecepatan tinggi yang tidak membutuhkan jaminan antrean tersimpan (fire-and-forget real-time).

### 2.1 Event: QR Code Baru (`wa:session:qr`)
Diterbitkan saat sesi Baileys meminta autentikasi pairing via QR Code.

```typescript
export interface WaSessionQrEvent {
  channelId: string        // UUID dari tabel channels_whatsapp_unofficial
  inboxId: string          // UUID dari inboxes
  qrCode: string           // Raw string QR code (untuk di-render di antarmuka web)
  expiresInSeconds: number // Durasi masa berlaku QR (biasanya 20-60 detik)
  timestamp: string        // ISO-8601
}
```

### 2.2 Event: Status Koneksi Sesi (`wa:session:status`)
Diterbitkan ketika status koneksi Baileys berubah.

```typescript
export interface WaSessionStatusEvent {
  channelId: string
  inboxId: string
  status: 'connecting' | 'open' | 'close' | 'qr_ready'
  phoneNumber?: string     // Nomor telepon yang tersambung (jika status 'open')
  reason?: string          // Penyebab putus (misal: 'logged_out', 'network_timeout')
  timestamp: string
}
```

### 2.3 Event: Pesan Masuk (`wa:inbound:message`)
Diterbitkan ketika ada pesan masuk dari pelanggan WhatsApp via Baileys.

```typescript
export interface WaInboundMessageEvent {
  channelId: string
  inboxId: string
  senderNumber: string     // Format E.164 (misal: "6281234567890")
  senderName?: string      // Push name WhatsApp pengguna
  externalMessageId: string // ID pesan unik dari WhatsApp (WTSID)
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'sticker'
  content?: string         // Isi teks pesan atau caption media
  media?: {
    mimeType: string
    fileName?: string
    fileSize?: number
    bufferBase64?: string  // Atau storage URL sementara jika file besar
  }
  replyToExternalId?: string // ID pesan yang di-reply jika ada
  timestamp: string
}
```

### 2.4 Event: Status Pengiriman Pesan (`wa:message:status`)
Diterbitkan ketika WhatsApp melaporkan tanda centang (sent, delivered, read) atau kegagalan.

```typescript
export interface WaMessageStatusEvent {
  externalMessageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  failureReason?: string
  timestamp: string
}
```

---

## 3. Antrean BullMQ (`apps/api` $\rightarrow$ `apps/wa-gateway`)

Menggunakan antrean BullMQ bernama **`wa-outbound`** untuk memastikan pesan keluar tidak hilang jika terjadi lonjakan lalu lintas atau reconnect socket sementara.

### 3.1 Job: Kirim Pesan WhatsApp (`send-message`)

```typescript
export interface SendWaMessageJobPayload {
  jobId: string            // UUID job
  messageId: string        // UUID dari tabel messages di database
  channelId: string        // UUID channels_whatsapp_unofficial
  recipientNumber: string  // Format E.164 (contoh: "6281234567890")
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document'
  text?: string
  mediaUrl?: string        // URL publik/lokal berkas media yang akan diunduh gateway
  fileName?: string
  replyToExternalId?: string
}
```

**Konfigurasi BullMQ Default**:
- `attempts`: 3 kali percobaan ulang.
- `backoff`: Exponential backoff (delay: 2000 ms).
- `removeOnComplete`: 1000 job tersimpan terakhir.
- `removeOnFail`: 5000 job untuk audit kegagalan pengiriman.

---

## 4. Server-Sent Events (SSE) (`apps/api` $\rightarrow$ `apps/web`)

Disediakan melalui endpoint `GET /api/v1/realtime/stream` untuk mengirimkan pembaruan live ke browser agent tanpa overhead polling.

### 4.1 Format Amplop Event (SSE Envelope)

```typescript
export interface RealtimeEvent<T = unknown> {
  event: string            // Tipe event (contoh: "message:created")
  data: T                  // Payload JSON
  timestamp: string
}
```

### 4.2 Daftar Event Realtime Dashboard

| Nama Event | Payload Data | Keterangan |
|---|---|---|
| `message:created` | Objek `Message` lengkap | Pesan baru masuk atau keluar di percakapan. |
| `message:status_updated` | `{ messageId: string, status: 'sent' \| 'delivered' \| 'read' \| 'failed' }` | Pembaruan centang WhatsApp. |
| `ticket:created` | Objek `Ticket` lengkap | Tiket baru terbentuk dari pesan pelanggan. |
| `ticket:updated` | `{ ticketId: string, status?: string, priority?: string, assigneeId?: string, internalNote?: string }` | Perubahan status/catatan/assignee tiket. |
| `conversation:updated` | `{ conversationId: string, lastActivityAt: string, unreadCount: number }` | Sinkronisasi urutan percakapan di sidebar. |
| `user:typing` | `{ conversationId: string, userType: 'agent' \| 'contact', userId?: string }` | Indikator sedang mengetik (*typing...*). |
| `user:presence` | `{ userId: string, status: 'online' \| 'busy' \| 'offline' }` | Status ketersediaan agent tim. |
| `wa:qr_updated` | `{ channelId: string, qrCode: string }` | Live QR Code saat admin menautkan nomor WhatsApp. |
