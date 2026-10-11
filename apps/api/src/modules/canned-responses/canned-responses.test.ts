import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { cannedResponseService, resetCannedResponseStore } from './canned-responses.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Canned Responses Module - Auth Guard', () => {
  it('GET /api/v1/canned-responses should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/canned-responses', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/canned-responses should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/canned-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortCode: 'halo', content: 'Halo, ada yang bisa dibantu?' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/canned-responses/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000'
    const res = await app.request(`/api/v1/canned-responses/${fakeId}`, {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/v1/canned-responses/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000'
    const res = await app.request(`/api/v1/canned-responses/${fakeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated' }),
    })
    expect(res.status).toBe(401)
  })

  it('DELETE /api/v1/canned-responses/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174000'
    const res = await app.request(`/api/v1/canned-responses/${fakeId}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(401)
  })
})

describe('Canned Responses Module - CRUD Operations', () => {
  beforeEach(() => {
    resetCannedResponseStore()
  })

  it('POST /api/v1/canned-responses should create canned response with valid input', async () => {
    const res = await app.request('/api/v1/canned-responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        shortCode: 'greeting_id',
        content: 'Halo! Selamat datang di layanan pelanggan kami.',
      }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.id).toBeDefined()
    expect(json.data.shortCode).toBe('greeting_id')
    expect(json.data.content).toBe('Halo! Selamat datang di layanan pelanggan kami.')
  })

  it('POST /api/v1/canned-responses should strip leading slash from shortCode', async () => {
    const res = await app.request('/api/v1/canned-responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        shortCode: '/salam',
        content: 'Assalamu alaikum, ada yang bisa kami bantu?',
      }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.shortCode).toBe('salam')
  })

  it('POST /api/v1/canned-responses should reject duplicate shortCode with 409', async () => {
    await cannedResponseService.createCannedResponse({
      shortCode: 'jam_kerja',
      content: 'Jam operasional kami: 09.00 - 18.00 WIB.',
    })

    const res = await app.request('/api/v1/canned-responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        shortCode: 'jam_kerja',
        content: 'Konten duplikat',
      }),
    })

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('POST /api/v1/canned-responses should reject empty shortCode or content with 400', async () => {
    const resEmptyCode = await app.request('/api/v1/canned-responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        shortCode: '',
        content: 'Konten valid',
      }),
    })
    expect(resEmptyCode.status).toBe(400)

    const resEmptyContent = await app.request('/api/v1/canned-responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        shortCode: 'valid_code',
        content: '',
      }),
    })
    expect(resEmptyContent.status).toBe(400)
  })

  it('GET /api/v1/canned-responses should list all canned responses', async () => {
    await cannedResponseService.createCannedResponse({
      shortCode: 'faq_1',
      content: 'Jawaban FAQ 1',
    })
    await cannedResponseService.createCannedResponse({
      shortCode: 'faq_2',
      content: 'Jawaban FAQ 2',
    })

    const res = await app.request('/api/v1/canned-responses', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThanOrEqual(2)
  })

  it('GET /api/v1/canned-responses/:id should return canned response by ID', async () => {
    const created = await cannedResponseService.createCannedResponse({
      shortCode: 'info_rekening',
      content: 'Nomor rekening BCA: 123-456-7890 a.n. PT Xatxoot.',
    })

    const res = await app.request(`/api/v1/canned-responses/${created.id}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.id).toBe(created.id)
    expect(json.data.shortCode).toBe('info_rekening')
  })

  it('GET /api/v1/canned-responses/:id should return 404 for non-existent ID', async () => {
    const fakeId = '123e4567-e89b-12d3-a456-426614174099'
    const res = await app.request(`/api/v1/canned-responses/${fakeId}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(404)
  })

  it('PATCH /api/v1/canned-responses/:id should update canned response', async () => {
    const created = await cannedResponseService.createCannedResponse({
      shortCode: 'kontak_cs',
      content: 'Konten lama',
    })

    const res = await app.request(`/api/v1/canned-responses/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        content: 'Konten baru yang telah diperbarui',
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.content).toBe('Konten baru yang telah diperbarui')
  })

  it('DELETE /api/v1/canned-responses/:id should delete canned response', async () => {
    const created = await cannedResponseService.createCannedResponse({
      shortCode: 'promo_habis',
      content: 'Promo ini sudah berakhir.',
    })

    const deleteRes = await app.request(`/api/v1/canned-responses/${created.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect(deleteRes.status).toBe(200)

    const getRes = await app.request(`/api/v1/canned-responses/${created.id}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    expect(getRes.status).toBe(404)
  })
})

describe('Canned Responses Module - Instant Prefix Shortcut Search', () => {
  beforeEach(async () => {
    resetCannedResponseStore()
    await cannedResponseService.createCannedResponse({
      shortCode: 'halo',
      content: 'Halo kak, ada yang bisa dibantu?',
    })
    await cannedResponseService.createCannedResponse({
      shortCode: 'halo_pagi',
      content: 'Selamat pagi kak, ada yang bisa dibantu?',
    })
    await cannedResponseService.createCannedResponse({
      shortCode: 'harga_ongkir',
      content: 'Tarif ongkos kirim standar adalah Rp 10.000.',
    })
    await cannedResponseService.createCannedResponse({
      shortCode: 'bantuan_billing',
      content: 'Untuk kendala billing dan pembayaran, silakan lampirkan bukti transfer.',
    })
  })

  it('should search canned responses matching prefix via ?q=ha', async () => {
    const res = await app.request('/api/v1/canned-responses?q=ha', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(3)
    const codes = json.data.map((item: { shortCode: string }) => item.shortCode)
    expect(codes).toContain('halo')
    expect(codes).toContain('halo_pagi')
    expect(codes).toContain('harga_ongkir')
    expect(codes).not.toContain('bantuan_billing')
  })

  it('should search canned responses gracefully handling slash prefix via ?search=/halo', async () => {
    const res = await app.request('/api/v1/canned-responses?search=/halo', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    const codes = json.data.map((item: { shortCode: string }) => item.shortCode)
    expect(codes).toContain('halo')
    expect(codes).toContain('halo_pagi')
    expect(codes).not.toContain('harga_ongkir')
  })

  it('should support ?prefix=bantuan parameter', async () => {
    const res = await app.request('/api/v1/canned-responses?prefix=bantuan', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].shortCode).toBe('bantuan_billing')
  })

  it('should return empty list when no prefix matches', async () => {
    const res = await app.request('/api/v1/canned-responses?q=nomatch', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(0)
  })
})

describe('Single Organization & Ubiquitous Language Integrity', () => {
  it('should verify Phase 2 checklist marks Task 2.12 as completed', () => {
    const checklistPath = new URL('../../../../../docs/PHASE_2_CHECKLIST.md', import.meta.url)
      .pathname
    const fs = require('node:fs')
    const checklistContent = fs.readFileSync(checklistPath, 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 2.12 (TDD)**: Test suite & implementasi `canned_responses` (pencarian instan berdasarkan prefix shortcut).',
    )
  })
})
