import { describe, expect, it, mock } from 'bun:test'
import type { SendWaMessageJobPayload } from '../types/queue'
import type { BaileysConnectionManager } from './baileys-connection-manager'
import { OutboundMessageDispatcher } from './outbound-dispatcher'

describe('Baileys Outbound Forward Message (Issue #300 - TDD RED)', () => {
  it('should include contextInfo.isForwarded when isForwarded is true in payload', async () => {
    let capturedJid = ''
    let capturedContent: Record<string, unknown> = {}
    let capturedOptions: Record<string, unknown> | undefined

    const mockSocket = {
      sendMessage: mock(
        async (
          jid: string,
          content: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => {
          capturedJid = jid
          capturedContent = content
          capturedOptions = options
          return { key: { id: 'WAM_FORWARD_001' } }
        },
      ),
    }

    const mockConnectionManager = {
      getAllSessions: () => [
        {
          sessionId: 'session-forward-1',
          channelId: 'chan-forward-1',
          status: 'connected',
          socket: mockSocket,
        },
      ],
    } as unknown as BaileysConnectionManager

    const dispatcher = new OutboundMessageDispatcher({
      connectionManager: mockConnectionManager,
    })

    const result = await dispatcher.sendMessage({
      jobId: '11111111-1111-4111-a111-111111111111',
      messageId: '22222222-2222-4222-a222-222222222222',
      channelId: 'chan-forward-1',
      recipientNumber: '628123456789',
      messageType: 'text',
      text: 'Ini adalah pesan yang diteruskan.',
      isForwarded: true,
      forwardingScore: 1,
    } satisfies SendWaMessageJobPayload)

    expect(result.success).toBe(true)
    expect(result.externalMessageId).toBe('WAM_FORWARD_001')
    expect(capturedJid).toBe('628123456789@s.whatsapp.net')

    const contextInfo = capturedContent.contextInfo as Record<string, unknown> | undefined
    expect(contextInfo).toBeDefined()
    expect(contextInfo?.isForwarded).toBe(true)
    expect(contextInfo?.forwardingScore).toBe(1)
  })

  it('should preserve group JID when recipientNumber is a group ending in @g.us', async () => {
    let capturedJid = ''
    const mockSocket = {
      sendMessage: mock(async (jid: string) => {
        capturedJid = jid
        return { key: { id: 'WAM_GROUP_FWD' } }
      }),
    }

    const mockConnectionManager = {
      getAllSessions: () => [
        {
          sessionId: 'session-forward-2',
          channelId: 'chan-forward-2',
          status: 'connected',
          socket: mockSocket,
        },
      ],
    } as unknown as BaileysConnectionManager

    const dispatcher = new OutboundMessageDispatcher({
      connectionManager: mockConnectionManager,
    })

    const groupJid = '120363209784423627@g.us'
    await dispatcher.sendMessage({
      jobId: '33333333-3333-4333-a333-333333333333',
      messageId: '44444444-4444-4444-a444-444444444444',
      channelId: 'chan-forward-2',
      recipientNumber: groupJid,
      messageType: 'text',
      text: 'Meneruskan info ke grup koordinasi.',
      isForwarded: true,
    } satisfies SendWaMessageJobPayload)

    expect(capturedJid).toBe(groupJid)
  })
})
