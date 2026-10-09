# Panduan Standar TDD (Test-Driven Development) — Xatxoot

> **Petunjuk Teknis untuk Developer & AI Agent**  
> Dokumen ini menjelaskan standar, struktur pengujian, dan contoh kode untuk menerapkan metodologi Test-Driven Development (TDD) di proyek **Xatxoot**.

---

## 1. Mengapa TDD Wajib untuk AI Multi-Agent?

Dalam pengembangan software yang dikerjakan oleh beberapa AI agent:
1. **Mencegah Halusinasi & Regresi**: AI agent rentan merusak kode yang dibuat agent lain jika tidak ada pagar pengujian (*safety net*).
2. **Kontrak yang Dapat Dieksekusi (*Executable Contract*)**: Test suite menjadi spesifikasi hidup (*living documentation*). Jika test lulus, fitur dijamin bekerja sesuai ekspektasi PRD.
3. **Arsitektur yang Lebih Bersih**: Menulis test terlebih dahulu memaksa agent mendesain fungsi yang modular, *loosely coupled*, dan mudah diuji.

---

## 2. Tooling Pengujian: `bun test`

Xatxoot menggunakan test runner bawaan **Bun** (`bun test`). 

### Keunggulan:
* **Kecepatan Tinggi (< 50ms per run)**: Tidak ada overhead transpilasi Babel/ts-node.
* **Kompatibel Penuh dengan Sintaks Standar Jest/Vitest**:
  ```typescript
  import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
  ```
* **Menjalankan Test**:
  ```bash
  # Jalankan seluruh test di monorepo
  bun test

  # Jalankan test pada file tertentu
  bun test apps/api/src/modules/tickets/tickets.test.ts

  # Jalankan test dengan watch mode
  bun test --watch
  ```

---

## 3. Empat Tingkatan Pengujian di Xatxoot

### A. Level 1: Unit Testing (Pure Functions, Enums & Zod Schemas)
Digunakan untuk menguji fungsi murni tanpa dependensi I/O: parsing nomor WhatsApp E.164, validasi payload Zod, transisi FSM status tiket, atau formatting markdown WhatsApp.

```typescript
// apps/api/src/utils/phone-formatter.test.ts
import { test, expect, describe } from "bun:test";
import { formatE164 } from "./phone-formatter";

describe("Phone Formatter (WhatsApp E.164)", () => {
  test("mengubah nomor 08123456789 menjadi format 628123456789", () => {
    expect(formatE164("08123456789")).toBe("628123456789");
  });

  test("membersihkan spasi, tanda minus, dan tanda plus", () => {
    expect(formatE164("+62 812-3456-789")).toBe("628123456789");
  });

  test("melempar error jika nomor tidak valid", () => {
    expect(() => formatE164("invalid123")).toThrow("Nomor telepon tidak valid");
  });
});
```

---

### B. Level 2: API Integration Testing (Hono `app.request()`)
Hono mendukung eksekusi endpoint berbasis Web Standards `Request` & `Response` secara instan **tanpa perlu menjalankan TCP port server**:

```typescript
// apps/api/src/modules/auth/auth.test.ts
import { test, expect, describe } from "bun:test";
import { app } from "../../app";

describe("Auth Endpoints", () => {
  test("POST /api/v1/auth/login gagal dengan email tidak terdaftar -> 401", async () => {
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "unknown@example.com",
        password: "WrongPassword123!",
      }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Kredensial tidak valid");
  });

  test("POST /api/v1/auth/login sukses mengembalikan token & cookie session", async () => {
    // Skenario kredensial valid
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@xatxoot.local",
        password: "AdminPassword123!",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.token).toBeDefined();
    expect(res.headers.get("set-cookie")).toContain("xatxoot_session=");
  });
});
```

---

### C. Level 3: Database Testing (PostgreSQL + Raw Bun SQL)
Untuk pengujian yang menyentuh database:
1. Jalankan test pada database testing terisolasi: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/xatxoot_test`.
2. **Pola Transaksi Bersih (*Transaction Rollback Pattern*)**:  
   Bungkus test case dalam transaksi SQL dan lakukan `ROLLBACK` di `afterEach()` agar database selalu bersih:

```typescript
// apps/api/src/modules/tickets/tickets.db.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { sql } from "../../db";

describe("Tickets DB Repository (Raw Bun SQL)", () => {
  beforeEach(async () => {
    await sql`BEGIN`;
  });

  afterEach(async () => {
    await sql`ROLLBACK`; // Batalkan seluruh query test agar DB tetap bersih
  });

  test("menyimpan dan membaca internal_note pada tiket", async () => {
    // 1. Insert tiket dummy
    const [ticket] = await sql`
      INSERT INTO tickets (status, priority, internal_note)
      VALUES ('open', 'medium', 'Catatan rahasia tim')
      RETURNING id, internal_note
    `;

    expect(ticket.id).toBeDefined();
    expect(ticket.internal_note).toBe("Catatan rahasia tim");

    // 2. Update internal note
    const [updated] = await sql`
      UPDATE tickets
      SET internal_note = 'Catatan telah diperbarui'
      WHERE id = ${ticket.id}
      RETURNING internal_note
    `;

    expect(updated.internal_note).toBe("Catatan telah diperbarui");
  });
});
```

---

### D. Level 4: WhatsApp Provider Mocking & Simulator
Saat menguji logika perpesanan WhatsApp, **jangan menembak Meta Graph API sungguhan**:

1. **Gunakan Mock Provider**:
   ```typescript
   export const mockWhatsAppProvider: WhatsAppProvider = {
     sendText: mock(async (to, text) => ({ messageId: "wamid.mock_123" })),
     sendMedia: mock(async (to, media) => ({ messageId: "wamid.mock_456" })),
     sendInteractive: mock(async () => ({ messageId: "wamid.mock_789" })),
     markRead: mock(async () => {}),
     getConnectionStatus: () => "connected",
   };
   ```
2. **Atau Gunakan `apps/wa-simulator`**:
   Arahkan environment `META_GRAPH_API_URL=http://localhost:3005/v18.0` untuk pengujian integrasi end-to-end tanpa internet luar.

---

## 4. Contoh Langkah Nyata TDD (Step-by-Step Walkthrough)

Misalkan seorang AI Agent ditugaskan membuat fitur:  
*"Tiket baru otomatis dibuat jika pesan masuk dari pelanggan dan tidak ada tiket aktif."*

### Langkah 1: 🔴 RED (Tulis Test Dulu)
Agent membuat file `apps/api/src/modules/tickets/ticket-automations.test.ts`:
```typescript
import { test, expect } from "bun:test";
import { handleInboundMessage } from "./ticket-automations";

test("membuat tiket baru dengan status 'open' jika conversation tidak memiliki tiket aktif", async () => {
  const result = await handleInboundMessage({
    conversationId: "conv-123",
    senderType: "contact",
    content: "Halo admin!",
  });

  expect(result.createdNewTicket).toBe(true);
  expect(result.ticket.status).toBe("open");
});
```
Agent menjalankan terminal:
```bash
bun test apps/api/src/modules/tickets/ticket-automations.test.ts
```
**Output**: `error: Cannot find module './ticket-automations'` $\rightarrow$ **TEST GAGAL (RED BERHASIL DIBUKTIKAN).**

---

### Langkah 2: 🟢 GREEN (Tulis Kode Minimal)
Agent membuat file `apps/api/src/modules/tickets/ticket-automations.ts`:
```typescript
export async function handleInboundMessage(payload: { conversationId: string; senderType: string; content: string }) {
  // Implementasi minimal untuk memenuhi assertion
  return {
    createdNewTicket: true,
    ticket: {
      status: "open",
      conversationId: payload.conversationId,
    },
  };
}
```
Agent menjalankan kembali terminal:
```bash
bun test apps/api/src/modules/tickets/ticket-automations.test.ts
```
**Output**: `1 pass, 0 fail` $\rightarrow$ **TEST LULUS (GREEN TERCAPAI).**

---

### Langkah 3: 🔵 REFACTOR (Sempurnakan Kode & Query DB)
Agent menghubungkan implementasi ke database dengan query PostgreSQL yang sebenarnya, validasi Zod, dan penanganan status `pending`:
```typescript
import { sql } from "../../db";

export async function handleInboundMessage(payload: { conversationId: string; senderType: string; content: string }) {
  const [activeTicket] = await sql`
    SELECT id, status FROM tickets 
    WHERE conversation_id = ${payload.conversationId} 
      AND status IN ('open', 'pending')
    LIMIT 1
  `;

  if (!activeTicket) {
    const [newTicket] = await sql`
      INSERT INTO tickets (conversation_id, status, priority)
      VALUES (${payload.conversationId}, 'open', 'medium')
      RETURNING id, status, conversation_id
    `;
    return { createdNewTicket: true, ticket: newTicket };
  }

  if (activeTicket.status === 'pending') {
    await sql`UPDATE tickets SET status = 'open' WHERE id = ${activeTicket.id}`;
    activeTicket.status = 'open';
  }

  return { createdNewTicket: false, ticket: activeTicket };
}
```
Agent menjalankan seluruh test suite:
```bash
bun test
```
**Output**: `All tests passed! (0 regressions)` $\rightarrow$ **REFACTOR SELESAI & TUGAS TUNTAS.**

---

## 5. Golden Rules untuk AI Agent

1. **Test Harus Deterministik**: Jangan gunakan `setTimeout` acak. Gunakan fungsi async/await atau fake timer dari Bun test.
2. **Fokus pada Perilaku (*Behavior*), Bukan Detail Internal**: Uji input dan output, bukan variabel private internal.
3. **Sertakan Bukti di Respon Chat**: Setiap kali melaporkan pekerjaan selesai, cantumkan potongan output terminal `bun test` kepada pengguna.
