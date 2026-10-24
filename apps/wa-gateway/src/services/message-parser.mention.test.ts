import { describe, expect, it } from 'bun:test'
import { extractInboundMessage } from './message-parser'

describe('WhatsApp Inbound Mention Parser (Issue #301 - TDD RED)', () => {
  const channelId = '11111111-1111-4111-a111-111111111111'
  const inboxId = '22222222-2222-4222-a222-222222222222'

  it('should extract mentionedJid from extendedTextMessage contextInfo and resolve phone/name', () => {
    const rawMsg = {
      key: {
        remoteJid: '120363209784423627@g.us',
        id: 'WAM_MENTION_001',
        fromMe: false,
        participant: '628111222333@s.whatsapp.net',
      },
      pushName: 'Budi Santoso',
      message: {
        extendedTextMessage: {
          text: 'Halo @137185600737333 tolong bantu follow up ya',
          contextInfo: {
            mentionedJid: ['137185600737333@lid'],
          },
        },
      },
      messageTimestamp: 1718000000,
    }

    const context = {
      channelId,
      inboxId,
      participantMap: {
        '137185600737333@lid': {
          phone: '+6289621475546',
          name: 'Fini Ardiani D',
        },
      },
    }

    const event = extractInboundMessage(rawMsg, context)
    expect(event).not.toBeNull()
    expect(event?.isGroup).toBe(true)
    expect(event?.groupJid).toBe('120363209784423627@g.us')
    expect(event?.mentions).toBeDefined()
    expect(event?.mentions?.length).toBe(1)
    expect(event?.mentions?.[0].jid).toBe('137185600737333@lid')
    expect(event?.mentions?.[0].phone).toBe('+6289621475546')
    expect(event?.mentions?.[0].name).toBe('Fini Ardiani D')
  })

  it('should extract mentionedJid from imageMessage caption contextInfo with standard WhatsApp JID', () => {
    const rawMsg = {
      key: {
        remoteJid: '120363209784423627@g.us',
        id: 'WAM_MENTION_002',
        fromMe: false,
        participant: '628111222333@s.whatsapp.net',
      },
      pushName: 'Budi Santoso',
      message: {
        imageMessage: {
          caption: 'Bukti transfer untuk @628123456789',
          mimetype: 'image/jpeg',
          contextInfo: {
            mentionedJid: ['628123456789@s.whatsapp.net'],
          },
        },
      },
      messageTimestamp: 1718000000,
    }

    const event = extractInboundMessage(rawMsg, { channelId, inboxId })
    expect(event).not.toBeNull()
    expect(event?.mentions).toBeDefined()
    expect(event?.mentions?.length).toBe(1)
    expect(event?.mentions?.[0].jid).toBe('628123456789@s.whatsapp.net')
    expect(event?.mentions?.[0].phone).toBe('628123456789')
  })
})
