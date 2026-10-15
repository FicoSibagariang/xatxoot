import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { Server } from 'node:http'
import { BaileysConnectionManager, createGatewayServer } from '../apps/wa-gateway/src/index'

describe('WhatsApp Gateway HTTP Control Server (Pairing & Session Management)', () => {
  let server: Server
  let baseUrl: string
  const manager = new BaileysConnectionManager()

  beforeAll(async () => {
    // Listen on port 0 for random free test port
    server = createGatewayServer(manager)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`
        }
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })

  it('GET /health should return 200 with status ok and active sessions count', async () => {
    const res = await fetch(`${baseUrl}/health`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(typeof data.activeSessions).toBe('number')
  })

  it('POST /api/sessions/start should create and register session in manager', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'test_server_session_1',
        channelId: 'channel_111',
        inboxId: 'inbox_222',
        autoStartSocket: false, // Don't start real WhatsApp socket in unit test
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.sessionId).toBe('test_server_session_1')
    expect(data.status).toBe('connecting')
    expect(manager.hasSession('test_server_session_1')).toBe(true)
  })

  it('GET /api/sessions/:sessionId/status should return session status and QR payload', async () => {
    const session = manager.getSession('test_server_session_1')
    expect(session).toBeDefined()
    if (session) {
      await session.emitQr('2@mock_server_test_qr_code')
    }

    const res = await fetch(`${baseUrl}/api/sessions/test_server_session_1/status`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sessionId).toBe('test_server_session_1')
    expect(data.status).toBe('pairing')
    expect(data.qrCode).toBe('2@mock_server_test_qr_code')
  })

  it('POST /api/sessions/:sessionId/disconnect should disconnect session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/test_server_session_1/disconnect`, {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.status).toBe('disconnected')

    const session = manager.getSession('test_server_session_1')
    expect(session?.status).toBe('disconnected')
  })

  it('GET /api/sessions/:sessionId/status should return disconnected for unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/non_existent_session/status`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sessionId).toBe('non_existent_session')
    expect(data.status).toBe('disconnected')
    expect(data.qrCode).toBeNull()
  })
})
