import { describe, expect, it } from 'bun:test'
import { extractInboundMessage } from './message-parser'

describe('WhatsApp Inbound Quoted Reply Parsing (Issue #301 - TDD RED)', () => {
  const context = {
    channelId: 'f0000000-0000-0000-0000-000000000001',
    inboxId: 'f0000000-0000-0000-0000-000000000002',
  }

  it('should extract replyToExternalId, quotedText, and quotedParticipant from extendedTextMessage', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: false,
        id: 'WAM_INBOUND_CUST_MSG_01',
      },
      pushName: 'Pelanggan Setia',
      messageTimestamp: 1700000000,
      message: {
        extendedTextMessage: {
          text: 'Iya kak, tolong kirim invoice-nya sekarang.',
          contextInfo: {
            stanzaId: 'WAM_AGENT_ORIGINAL_MSG_99',
            participant: '628999888777@s.whatsapp.net',
            quotedMessage: {
              conversation:
                'Total tagihan Anda adalah Rp 250.000, apakah ingin kami buatkan invoice?',
            },
          },
        },
      },
    }

    const event = extractInboundMessage(rawMsg, context)
    expect(event).not.toBeNull()
    expect(event?.content).toBe('Iya kak, tolong kirim invoice-nya sekarang.')
    expect(event?.replyToExternalId).toBe('WAM_AGENT_ORIGINAL_MSG_99')
    expect(event?.quotedText).toBe(
      'Total tagihan Anda adalah Rp 250.000, apakah ingin kami buatkan invoice?',
    )
    expect(event?.quotedParticipant).toBe('628999888777@s.whatsapp.net')
  })

  it('should extract quoted info from imageMessage contextInfo', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: false,
        id: 'WAM_INBOUND_IMAGE_01',
      },
      pushName: 'Pelanggan Setia',
      messageTimestamp: 1700000001,
      message: {
        imageMessage: {
          caption: 'Ini bukti transfernya kak',
          mimetype: 'image/jpeg',
          contextInfo: {
            stanzaId: 'WAM_AGENT_ORIGINAL_MSG_100',
            participant: '628999888777@s.whatsapp.net',
            quotedMessage: {
              extendedTextMessage: {
                text: 'Silakan transfer ke rekening BCA 1234567890 an Xatxoot.',
              },
            },
          },
        },
      },
    }

    const event = extractInboundMessage(rawMsg, context)
    expect(event).not.toBeNull()
    expect(event?.messageType).toBe('image')
    expect(event?.replyToExternalId).toBe('WAM_AGENT_ORIGINAL_MSG_100')
    expect(event?.quotedText).toBe('Silakan transfer ke rekening BCA 1234567890 an Xatxoot.')
    expect(event?.quotedParticipant).toBe('628999888777@s.whatsapp.net')
  })
})
