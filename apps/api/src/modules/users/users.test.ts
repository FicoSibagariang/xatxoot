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

  it('Option A: agent created with password can log in with email and password AND Google SSO', async () => {
    const dualUserEmail = `dual-${Date.now()}@example.com`
    const initialPassword = 'PasswordRahasia123!'

    // 1. Admin creates agent with optional password
    const createRes = await app.request('/api/v1/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: dualUserEmail,
        displayName: 'Agent Multi-Login',
        role: 'agent',
        password: initialPassword,
      }),
    })
    expect(createRes.status).toBe(201)

    // 2. Agent logs in with email and password
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dualUserEmail,
        password: initialPassword,
      }),
    })
    expect(loginRes.status).toBe(200)
    const loginBody = await loginRes.json()
    expect(loginBody.user.email).toBe(dualUserEmail)
    expect(loginBody.tokens.accessToken).toBeDefined()

    // 3. Agent can ALSO still log in with Google SSO
    const ssoRes = await app.request(
      `/api/v1/auth/google/callback?code=mock_code&email=${dualUserEmail}`,
    )
    expect(ssoRes.status).toBe(200)
    const ssoBody = await ssoRes.json()
    expect(ssoBody.user.email).toBe(dualUserEmail)
  })

  it('Option A: agent created without password CANNOT log in via password form until password is set', async () => {
    const ssoOnlyEmail = `sso-only-${Date.now()}@example.com`

    // 1. Admin creates agent without password
    const createRes = await app.request('/api/v1/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: ssoOnlyEmail,
        displayName: 'Agent SSO Only',
        role: 'agent',
      }),
    })
    expect(createRes.status).toBe(201)
    const createdUser = (await createRes.json()).data

    // 2. Trying to log in with arbitrary password should fail (401)
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ssoOnlyEmail,
        password: 'AnyPassword123!',
      }),
    })
    expect(loginRes.status).toBe(401)

    // 3. Admin sets password via PATCH /api/v1/users/:id
    const newPassword = 'NewlySetPassword456!'
    const patchRes = await app.request(`/api/v1/users/${createdUser.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({
        password: newPassword,
      }),
    })
    expect(patchRes.status).toBe(200)

    // 4. Now agent can log in with the newly set password
    const newLoginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ssoOnlyEmail,
        password: newPassword,
      }),
    })
    expect(newLoginRes.status).toBe(200)
  })
})
