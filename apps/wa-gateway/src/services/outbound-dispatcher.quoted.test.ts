import { describe, expect, it, mock } from 'bun:test'
import { BaileysConnectionManager } from './baileys-connection-manager'
import { OutboundMessageDispatcher } from './outbound-dispatcher'

describe('Baileys Quoted Reply Dispatcher (Issue #286 - TDD RED)', () => {
  it('should pass WhatsApp quoted options when replyToExternalId is provided in job payload', async () => {
    const manager = new BaileysConnectionManager()
    const session = await manager.createSession({
      sessionId: 'test_quoted_session',
      channelId: 'channel_quoted_1',
    })

    let capturedOptions: Record<string, unknown> | undefined

    session.status = 'connected'
    session.socket = {
      sendMessage: mock(
        async (
          jid: string,
          content: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => {
          capturedOptions = options
          return { key: { id: 'WAM_REPLY_SENT_001' } }
        },
      ),
      // biome-ignore lint/suspicious/noExplicitAny: mock socket
    } as any

    const dispatcher = new OutboundMessageDispatcher({
      connectionManager: manager,
    })

    const result = await dispatcher.sendMessage({
      jobId: '11111111-2222-4333-8444-555555555555',
      messageId: '66666666-7777-4888-8999-000000000000',
      channelId: 'channel_quoted_1',
      recipientNumber: '+6281234567890',
      messageType: 'text',
      text: 'Ya kak, pesanan Anda sudah dikirim tadi pagi.',
      replyToExternalId: 'WAM_ORIGINAL_CUSTOMER_MSG_123',
      quotedText: 'Apakah paket saya sudah dikirim kemarin?',
    })

    expect(result.success).toBe(true)
    expect(result.externalMessageId).toBe('WAM_REPLY_SENT_001')

    // Expect quoted options passed to Baileys socket.sendMessage
    expect(capturedOptions).toBeDefined()
    // biome-ignore lint/suspicious/noExplicitAny: inspection
    const quoted = (capturedOptions as any)?.quoted
    expect(quoted).toBeDefined()
    expect(quoted.key.id).toBe('WAM_ORIGINAL_CUSTOMER_MSG_123')
    expect(quoted.key.remoteJid).toBe('6281234567890@s.whatsapp.net')
    expect(quoted.key.fromMe).toBe(false)
    expect(quoted.message.conversation).toBe('Apakah paket saya sudah dikirim kemarin?')
  })
})
