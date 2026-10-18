import { describe, expect, it } from 'bun:test'
import app from '../../index'

describe('User & Agent Management Module (/api/v1/users)', () => {
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer access_admin_token',
  }

  const agentHeaders = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer access_agent_token',
  }

  it('GET /api/v1/users should reject request without authorization header with 401', async () => {
    const res = await app.request('/api/v1/users')
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/users should reject creation with invalid email format with 400', async () => {
    const res = await app.request('/api/v1/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: 'bukan-email',
        displayName: 'Agent Baru',
        role: 'agent',
      }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('POST /api/v1/users should successfully create a new agent with designated role', async () => {
    const testEmail = `agent-${Date.now()}@nusa.net.id`
    const res = await app.request('/api/v1/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: testEmail,
        displayName: 'Budi Santoso',
        role: 'agent',
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBeDefined()
    expect(body.data.email).toBe(testEmail)
    expect(body.data.displayName).toBe('Budi Santoso')
    expect(body.data.role).toBe('agent')
    expect(body.data.active).toBe(true)
  })

  it('POST /api/v1/users should reject duplicate email with 409 Conflict', async () => {
    const dupEmail = `dup-${Date.now()}@nusa.net.id`
    await app.request('/api/v1/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: dupEmail,
        displayName: 'Original Agent',
        role: 'agent',
      }),
    })

    const dupRes = await app.request('/api/v1/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: dupEmail,
        displayName: 'Duplicate Agent',
        role: 'agent',
      }),
    })

    expect(dupRes.status).toBe(409)
    const body = await dupRes.json()
    expect(body.error).toContain('sudah terdaftar')
  })

  it('GET /api/v1/users should list all registered users', async () => {
    const res = await app.request('/api/v1/users', {
      headers: adminHeaders,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('PATCH /api/v1/users/:id should update user role and active status', async () => {
    const targetEmail = `update-target-${Date.now()}@nusa.net.id`
    const createRes = await app.request('/api/v1/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: targetEmail,
        displayName: 'Target Edit',
        role: 'agent',
      }),
    })
    const created = await createRes.json()

    const patchRes = await app.request(`/api/v1/users/${created.data.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({
        displayName: 'Target Edit Renamed',
        role: 'administrator',
        active: false,
      }),
    })

    expect(patchRes.status).toBe(200)
    const patchBody = await patchRes.json()
    expect(patchBody.data.displayName).toBe('Target Edit Renamed')
    expect(patchBody.data.role).toBe('administrator')
    expect(patchBody.data.active).toBe(false)
  })

  it('Google SSO callback should REJECT email that has not been pre-registered with 403', async () => {
    const unregisteredEmail = `unregistered-${Date.now()}@example.com`
    const res = await app.request(
      `/api/v1/auth/google/callback?code=mock_code&email=${unregisteredEmail}`,
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('belum terdaftar')
  })

  it('Google SSO callback should ACCEPT email that has been pre-registered by administrator', async () => {
    const registeredEmail = `registered-${Date.now()}@example.com`
    // Pre-register user first
    await app.request('/api/v1/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: registeredEmail,
        displayName: 'Staf Terdaftar',
        role: 'agent',
      }),
    })

    const res = await app.request(
      `/api/v1/auth/google/callback?code=mock_code&email=${registeredEmail}`,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
