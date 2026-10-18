import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { resetContactStore } from './contacts.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Contacts Module — Update & CRM API (Task /contacts)', () => {
  beforeEach(() => {
    resetContactStore()
  })

  it('GET /api/v1/contacts should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/contacts', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/v1/contacts/:id should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/contacts/c9f1c4c0-e9a8-45cf-aa24-7b7cf9a027f0', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/contacts should create a new contact with status 201', async () => {
    const res = await app.request('/api/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Rian Prasetya',
        phoneNumber: '+6281122334455',
        email: 'rian@perusahaan.co.id',
        additionalAttributes: { company: 'PT Inovasi Mandiri' },
      }),
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.name).toBe('Rian Prasetya')
    expect(data.phoneNumber).toBe('+6281122334455')
  })

  it('GET /api/v1/contacts should list contacts with status 200', async () => {
    // 1. Create contact
    await app.request('/api/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'List Target',
        phoneNumber: '+62899998888',
      }),
    })

    const res = await app.request('/api/v1/contacts', {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('PATCH /api/v1/contacts/:id should return 404 for non-existent contact ID', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000'
    const res = await app.request(`/api/v1/contacts/${nonExistentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ name: 'Hantu' }),
    })
    expect(res.status).toBe(404)
  })

  it('PATCH /api/v1/contacts/:id should return 400 for invalid email format', async () => {
    const res = await app.request('/api/v1/contacts/c9f1c4c0-e9a8-45cf-aa24-7b7cf9a027f0', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ email: 'bukan-email' }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH /api/v1/contacts/:id should successfully update name, email, and attributes', async () => {
    // 1. Create a contact first
    const createRes = await app.request('/api/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Initial Name',
        phoneNumber: '+628123499999',
        email: 'initial@example.com',
      }),
    })
    const created = await createRes.json()

    // 2. Update contact
    const updatedName = 'Updated Name'
    const updatedEmail = 'updated@example.com'

    const patchRes = await app.request(`/api/v1/contacts/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: updatedName,
        email: updatedEmail,
        additionalAttributes: { company: 'PT Solusi Terpadu' },
      }),
    })

    expect(patchRes.status).toBe(200)
    const updated = await patchRes.json()
    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe(updatedName)
    expect(updated.email).toBe(updatedEmail)
    expect(updated.additionalAttributes?.company).toBe('PT Solusi Terpadu')
  })
})
