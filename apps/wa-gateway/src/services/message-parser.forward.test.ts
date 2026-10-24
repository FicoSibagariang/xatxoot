import { describe, expect, it } from 'bun:test'
import { extractInboundMessage } from './message-parser'

describe('WhatsApp Inbound Forward Message Parser (Issue #300 - TDD RED)', () => {
  it('should parse isForwarded flag and forwardingScore from contextInfo', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: false,
        id: 'WAM_IN_FWD_01',
      },
      message: {
        extendedTextMessage: {
          text: 'Pemberitahuan perubahan jadwal pengiriman.',
          contextInfo: {
            isForwarded: true,
            forwardingScore: 2,
          },
        },
      },
      messageTimestamp: 1729480000,
      pushName: 'Pelanggan Setia',
    }

    const event = extractInboundMessage(
      rawMsg,
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
    )

    expect(event).not.toBeNull()
    expect(event?.isForwarded).toBe(true)
    expect(event?.forwardingScore).toBe(2)
  })
})
