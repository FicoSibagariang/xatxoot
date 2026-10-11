import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import {
  resetSlashCommandStore,
  sanitizeResponseContent,
  slashCommandService,
} from './slash-commands.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Slash Commands Module - Auth Guard', () => {
  it('GET /api/v1/slash-commands should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/slash-commands', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/slash-commands should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/slash-commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'cek_ongkir',
        endpointUrl: 'https://example.com/webhook',
      }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/slash-commands/execute should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/slash-commands/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'cek_ongkir',
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })
    expect(res.status).toBe(401)
  })
})

describe('Slash Commands Module - CRUD Operations', () => {
  beforeEach(() => {
    resetSlashCommandStore()
  })

  it('POST /api/v1/slash-commands should create a slash command and strip leading slash', async () => {
    const res = await app.request('/api/v1/slash-commands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: '/cek_ongkir',
        description: 'Cek tarif ongkos kirim',
        endpointUrl: 'https://api.logistik.test/rates',
        authHeader: 'Bearer secret-key-123',
      }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.id).toBeDefined()
    expect(json.data.name).toBe('cek_ongkir')
    expect(json.data.endpointUrl).toBe('https://api.logistik.test/rates')
  })

  it('POST /api/v1/slash-commands should reject duplicate command name with 409', async () => {
    await slashCommandService.createSlashCommand({
      name: 'lacak_resi',
      endpointUrl: 'https://api.logistik.test/track',
    })

    const res = await app.request('/api/v1/slash-commands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'lacak_resi',
        endpointUrl: 'https://api.other.test/track',
      }),
    })

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('POST /api/v1/slash-commands should reject invalid endpointUrl with 400', async () => {
    const res = await app.request('/api/v1/slash-commands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'bad_cmd',
        endpointUrl: 'not-a-valid-url',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('GET /api/v1/slash-commands should list all slash commands', async () => {
    await slashCommandService.createSlashCommand({
      name: 'cmd_1',
      endpointUrl: 'https://api.test/cmd1',
    })
    await slashCommandService.createSlashCommand({
      name: 'cmd_2',
      endpointUrl: 'https://api.test/cmd2',
    })

    const res = await app.request('/api/v1/slash-commands', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThanOrEqual(2)
  })

  it('GET /api/v1/slash-commands/:id should return command by ID', async () => {
    const created = await slashCommandService.createSlashCommand({
      name: 'info_stok',
      endpointUrl: 'https://api.warehouse.test/stock',
    })

    const res = await app.request(`/api/v1/slash-commands/${created.id}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.id).toBe(created.id)
    expect(json.data.name).toBe('info_stok')
  })

  it('PATCH /api/v1/slash-commands/:id should update slash command', async () => {
    const created = await slashCommandService.createSlashCommand({
      name: 'kurs_valas',
      endpointUrl: 'https://api.bank.test/v1/rates',
    })

    const res = await app.request(`/api/v1/slash-commands/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        endpointUrl: 'https://api.bank.test/v2/rates',
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.endpointUrl).toBe('https://api.bank.test/v2/rates')
  })

  it('DELETE /api/v1/slash-commands/:id should delete slash command', async () => {
    const created = await slashCommandService.createSlashCommand({
      name: 'temp_cmd',
      endpointUrl: 'https://api.temp.test',
    })

    const deleteRes = await app.request(`/api/v1/slash-commands/${created.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect(deleteRes.status).toBe(200)

    const getRes = await app.request(`/api/v1/slash-commands/${created.id}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    expect(getRes.status).toBe(404)
  })
})

describe('Slash Commands Module - Execution Worker & Timeout & Sanitization', () => {
  let mockServer: ReturnType<typeof Bun.serve>
  let mockPort: number

  beforeAll(() => {
    mockServer = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url)

        if (url.pathname === '/fast-success') {
          return new Response(
            JSON.stringify({
              content: 'Ongkir JNE Reguler ke Jakarta: Rp 12.000 (Estimasi 2-3 hari)',
              metadata: { courier: 'JNE', service: 'REG' },
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        if (url.pathname === '/malicious-xss') {
          return new Response(
            JSON.stringify({
              content:
                'Hasil pencarian: <script>alert("XSS-ATTACK")</script><img src=x onerror=alert(1)><b>Paket Aman</b>',
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        if (url.pathname === '/slow-timeout') {
          // Sleep for 4 seconds to trigger 3s timeout
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(new Response('Too late', { status: 200 }))
            }, 4000)
          })
        }

        if (url.pathname === '/server-error') {
          return new Response('Internal Webhook Error', { status: 500 })
        }

        return new Response('Not found', { status: 404 })
      },
    })
    mockPort = mockServer.port
  })

  afterAll(() => {
    mockServer.stop()
  })

  beforeEach(() => {
    resetSlashCommandStore()
  })

  it('POST /api/v1/slash-commands/execute should execute webhook and return sanitized output', async () => {
    await slashCommandService.createSlashCommand({
      name: 'ongkir',
      endpointUrl: `http://localhost:${mockPort}/fast-success`,
      authHeader: 'Bearer mock-auth',
    })

    const res = await app.request('/api/v1/slash-commands/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        command: '/ongkir',
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        ticketId: '123e4567-e89b-12d3-a456-426614174001',
        params: 'Jakarta Barat',
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.content).toContain('Ongkir JNE Reguler ke Jakarta: Rp 12.000')
    expect(json.data.metadata.courier).toBe('JNE')
  })

  it('POST /api/v1/slash-commands/execute should sanitize XSS / script tags in response', async () => {
    await slashCommandService.createSlashCommand({
      name: 'xss_test',
      endpointUrl: `http://localhost:${mockPort}/malicious-xss`,
    })

    const res = await app.request('/api/v1/slash-commands/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        command: 'xss_test',
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.content).not.toContain('<script>')
    expect(json.data.content).not.toContain('onerror=')
    expect(json.data.content).toContain('Paket Aman')
  })

  it('POST /api/v1/slash-commands/execute should enforce 3-second strict timeout (504 Gateway Timeout)', async () => {
    await slashCommandService.createSlashCommand({
      name: 'slow_cmd',
      endpointUrl: `http://localhost:${mockPort}/slow-timeout`,
    })

    const startTime = Date.now()
    const res = await app.request('/api/v1/slash-commands/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        command: 'slow_cmd',
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })
    const duration = Date.now() - startTime

    expect(res.status).toBe(504)
    const json = await res.json()
    expect(json.error).toContain('3') // mentions 3 detik / 3000ms
    expect(duration).toBeLessThan(3900) // timed out around 3s, not waited 4s
  })

  it('should verify sanitizeResponseContent unit helper', () => {
    const raw = '<script>alert(1)</script>Halo <b>Teman</b> <iframe src="evil.com"></iframe>'
    const clean = sanitizeResponseContent(raw)
    expect(clean).not.toContain('<script>')
    expect(clean).not.toContain('<iframe>')
    expect(clean).toContain('Halo')
  })
})

describe('Single Organization & Ubiquitous Language Integrity', () => {
  it('should verify Phase 2 checklist marks Task 2.13 as completed', () => {
    const checklistPath = new URL('../../../../../docs/PHASE_2_CHECKLIST.md', import.meta.url)
      .pathname
    const fs = require('node:fs')
    const checklistContent = fs.readFileSync(checklistPath, 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 2.13 (TDD)**: Test suite & implementasi `slash_commands`:',
    )
  })
})
