import { describe, expect, it } from 'bun:test'
import { extractInboundMessage } from './message-parser'

describe('WhatsApp Gateway - WhatsApp Group Parser (Issue #288 - TDD RED)', () => {
  const context = {
    channelId: '11111111-1111-4111-8111-111111111111',
    inboxId: '22222222-2222-4222-8222-222222222222',
    channelPhone: '62811111111',
    companyPhoneNumbers: ['62811111111', '62822222222'],
  }

  it('should parse group message ending with @g.us instead of dropping it', () => {
    const rawGroupMsg = {
      key: {
        remoteJid: '120363209784423627@g.us',
        id: 'WA_GRP_MSG_001',
        fromMe: false,
        participant: '6281234567890@s.whatsapp.net',
      },
      pushName: 'Ahmad Customer',
      message: {
        conversation: 'Halo tim Xatxoot, mohon update status proyek.',
      },
      messageTimestamp: 1729490000,
    }

    const parsed = extractInboundMessage(rawGroupMsg, context)

    expect(parsed).not.toBeNull()
    expect(parsed?.isGroup).toBe(true)
    expect(parsed?.groupJid).toBe('120363209784423627@g.us')
    expect(parsed?.participant).toBe('6281234567890')
    expect(parsed?.senderName).toBe('Ahmad Customer')
    expect(parsed?.content).toBe('Halo tim Xatxoot, mohon update status proyek.')
  })

  it('should identify internal channel participant inside group as echo/outgoing message', () => {
    const rawInternalMsg = {
      key: {
        remoteJid: '120363209784423627@g.us',
        id: 'WA_GRP_MSG_002',
        fromMe: false,
        participant: '62822222222@s.whatsapp.net', // Belongs to companyPhoneNumbers
      },
      pushName: 'Sales Manager',
      message: {
        conversation: 'Siap Pak, dokumen PO sedang kami siapkan.',
      },
      messageTimestamp: 1729490060,
    }

    const parsed = extractInboundMessage(rawInternalMsg, context)

    expect(parsed).not.toBeNull()
    expect(parsed?.isGroup).toBe(true)
    expect(parsed?.participant).toBe('62822222222')
    expect(parsed?.isEcho).toBe(true)
  })
})
