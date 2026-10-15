import { describe, expect, it, mock } from 'bun:test'
import { createServer } from 'node:http'
import { BaileysConnectionManager } from './baileys-connection-manager'
import { createGatewayServer } from './gateway-server'
import { OutboundMessageDispatcher } from './outbound-dispatcher'

describe('OutboundMessageDispatcher & Gateway Server', () => {
  it('should clean recipient number (remove leading + and non-digits) when building WhatsApp JID', async () => {
    const manager = new BaileysConnectionManager()
    const session = await manager.createSession({
      sessionId: 'test_session_1',
      channelId: 'channel_123',
    })

    let sentJid = ''
    let sentContent: Record<string, unknown> = {}

    session.status = 'connected'
    session.socket = {
      sendMessage: mock(async (jid: string, content: Record<string, unknown>) => {
        sentJid = jid
        sentContent = content
        return { key: { id: 'WAM_MSG_TEST_001' } }
      }),
      // biome-ignore lint/suspicious/noExplicitAny: mock socket
    } as any

    const dispatcher = new OutboundMessageDispatcher({
      connectionManager: manager,
    })

    const result = await dispatcher.sendMessage({
      jobId: '11111111-1111-4111-a111-111111111111',
      messageId: '22222222-2222-4222-a222-222222222222',
      channelId: 'channel_123',
      recipientNumber: '+62 819-6066-607',
      messageType: 'text',
      text: 'Halo kak, pesanan sudah dikirim!',
    })

    expect(result.success).toBe(true)
    expect(result.externalMessageId).toBe('WAM_MSG_TEST_001')
    expect(sentJid).toBe('628196066607@s.whatsapp.net')
    expect(sentContent.text).toBe('Halo kak, pesanan sudah dikirim!')
  })

  it('should resolve session by sessionId or fallback to single connected session', async () => {
    const manager = new BaileysConnectionManager()
    const session = await manager.createSession({
      sessionId: 'wa_3c320b25-1911-4be6-921b-78df3422b9a8',
    })

    let sentJid = ''
    session.status = 'connected'
    session.socket = {
      sendMessage: mock(async (jid: string) => {
        sentJid = jid
        return { key: { id: 'WAM_RES_FALLBACK' } }
      }),
      // biome-ignore lint/suspicious/noExplicitAny: mock socket
    } as any

    const dispatcher = new OutboundMessageDispatcher({
      connectionManager: manager,
    })

    // Calling with a channel UUID that was not explicitly set on session
    const result = await dispatcher.sendMessage({
      jobId: '11111111-1111-4111-a111-111111111111',
      messageId: '22222222-2222-4222-a222-222222222222',
      channelId: '1cff9a0f-b755-499e-8521-eb26aefc757a',
      recipientNumber: '628196066607',
      messageType: 'text',
      text: 'Testing single connected session fallback',
    })

    expect(result.success).toBe(true)
    expect(result.externalMessageId).toBe('WAM_RES_FALLBACK')
    expect(sentJid).toBe('628196066607@s.whatsapp.net')
  })

  it('should handle POST /api/messages/send on gateway server', async () => {
    const manager = new BaileysConnectionManager()
    const session = await manager.createSession({
      sessionId: 'gateway_test_session',
      channelId: 'gw_channel_1',
    })

    session.status = 'connected'
    session.socket = {
      sendMessage: mock(async () => {
        return { key: { id: 'WAM_HTTP_SUCCESS' } }
      }),
      // biome-ignore lint/suspicious/noExplicitAny: mock socket
    } as any

    const dispatcher = new OutboundMessageDispatcher({
      connectionManager: manager,
    })

    const server = createGatewayServer(manager, { dispatcher })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address() as { port: number }

    try {
      const res = await fetch(`http://127.0.0.1:${address.port}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: '11111111-1111-4111-a111-111111111111',
          messageId: '22222222-2222-4222-a222-222222222222',
          channelId: 'gw_channel_1',
          recipientNumber: '+628196066607',
          messageType: 'text',
          text: 'Pesan melalui gateway server HTTP',
        }),
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as { success: boolean; externalMessageId: string }
      expect(data.success).toBe(true)
      expect(data.externalMessageId).toBe('WAM_HTTP_SUCCESS')
    } finally {
      server.close()
    }
  })
})
