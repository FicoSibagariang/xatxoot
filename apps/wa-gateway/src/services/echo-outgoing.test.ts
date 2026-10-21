import { describe, expect, it } from 'bun:test'
import { extractInboundMessage } from './message-parser'
import { outboundTracker } from './outbound-tracker'

describe('Echo Outgoing Sync — Message Parser & Outbound Tracker (TDD RED)', () => {
  it('extractInboundMessage should return null for fromMe: true when isEcho is false', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: true,
        id: 'BAE5ECHO123456',
      },
      message: {
        conversation: 'Pesan balasan langsung dari WhatsApp HP',
      },
      messageTimestamp: 1713000000,
    }

    const result = extractInboundMessage(rawMsg, {
      channelId: '11111111-1111-4111-a111-111111111111',
      inboxId: '22222222-2222-4222-a222-222222222222',
      isEcho: false,
    })

    expect(result).toBeNull()
  })

  it('extractInboundMessage should parse message and set isEcho: true when isEcho: true', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: true,
        id: 'BAE5ECHO123456',
      },
      message: {
        conversation: 'Pesan balasan langsung dari WhatsApp HP',
      },
      messageTimestamp: 1713000000,
    }

    const result = extractInboundMessage(rawMsg, {
      channelId: '11111111-1111-4111-a111-111111111111',
      inboxId: '22222222-2222-4222-a222-222222222222',
      isEcho: true,
    })

    expect(result).not.toBeNull()
    expect(result?.senderNumber).toBe('628123456789')
    expect(result?.externalMessageId).toBe('BAE5ECHO123456')
    expect(result?.content).toBe('Pesan balasan langsung dari WhatsApp HP')
    expect(result?.messageType).toBe('text')
    expect(result?.isEcho).toBe(true)
  })

  it('extractInboundMessage should NOT assign the agent pushName to senderName when isEcho is true', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: true,
        id: 'BAE5ECHO123456',
      },
      pushName: 'Nia', // Agent/channel profile name
      message: {
        conversation: 'Pesan keluar dari Nia ke pelanggan',
      },
      messageTimestamp: 1713000000,
    }

    const result = extractInboundMessage(rawMsg, {
      channelId: '11111111-1111-4111-a111-111111111111',
      inboxId: '22222222-2222-4222-a222-222222222222',
      isEcho: true,
    })

    expect(result).not.toBeNull()
    expect(result?.senderNumber).toBe('628123456789')
    // senderName must NOT be 'Nia'!
    expect(result?.senderName).toBeUndefined()
  })

  it('extractInboundMessage should parse group message with isGroup: true and ignore @broadcast even if isEcho: true', () => {
    const groupMsg = {
      key: {
        remoteJid: '12036304123456789@g.us',
        fromMe: true,
        id: 'BAE5ECHOGROUP',
      },
      message: { conversation: 'Halo grup!' },
    }

    const broadcastMsg = {
      key: {
        remoteJid: 'status@broadcast',
        fromMe: true,
        id: 'BAE5ECHOBROADCAST',
      },
      message: { conversation: 'Status update' },
    }

    const parsedGroup = extractInboundMessage(groupMsg, {
      channelId: '11111111-1111-4111-a111-111111111111',
      inboxId: '22222222-2222-4222-a222-222222222222',
      isEcho: true,
    })
    expect(parsedGroup?.isGroup).toBe(true)
    expect(parsedGroup?.isEcho).toBe(true)

    expect(
      extractInboundMessage(broadcastMsg, {
        channelId: '11111111-1111-4111-a111-111111111111',
        inboxId: '22222222-2222-4222-a222-222222222222',
        isEcho: true,
      }),
    ).toBeNull()
  })

  it('outboundTracker should track, verify and consume dispatched outbound message IDs', () => {
    outboundTracker.clear()
    const testId = 'WAM_DASHBOARD_DISPATCH_999'

    expect(outboundTracker.isRecent(testId)).toBe(false)
    expect(outboundTracker.consume(testId)).toBe(false)

    outboundTracker.track(testId)
    expect(outboundTracker.isRecent(testId)).toBe(true)

    // Consume once (should return true and remove it)
    expect(outboundTracker.consume(testId)).toBe(true)
    expect(outboundTracker.isRecent(testId)).toBe(false)
    expect(outboundTracker.consume(testId)).toBe(false)
  })
})
