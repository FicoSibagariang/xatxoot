import { describe, expect, it } from 'bun:test'
import { extractInboundMessage } from './message-parser'

describe('WhatsApp Message Revoke Parser (TDD RED)', () => {
  const channelId = '11111111-1111-4111-a111-111111111111'
  const inboxId = '22222222-2222-4222-a222-222222222222'

  it('should detect protocolMessage type 0 (REVOKE) and return isRevoke payload', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: false,
        id: 'REVOKE_CONTAINER_ID_001',
      },
      message: {
        protocolMessage: {
          key: {
            remoteJid: '628123456789@s.whatsapp.net',
            fromMe: false,
            id: 'ORIGINAL_MSG_TO_REVOKE_001',
          },
          type: 0,
        },
      },
      messageTimestamp: 1713001000,
    }

    const result = extractInboundMessage(rawMsg, { channelId, inboxId })

    expect(result).not.toBeNull()
    expect(result?.isRevoke).toBe(true)
    expect(result?.targetExternalId).toBe('ORIGINAL_MSG_TO_REVOKE_001')
    expect(result?.revokedAt).toBeDefined()
  })

  it('should return isRevoke=true for fromMe=true outgoing revoke when isEcho=true', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: true,
        id: 'REVOKE_ECHO_CONTAINER_001',
      },
      message: {
        protocolMessage: {
          key: {
            remoteJid: '628123456789@s.whatsapp.net',
            fromMe: true,
            id: 'OUTGOING_MSG_TO_REVOKE_001',
          },
          type: 0,
        },
      },
      messageTimestamp: 1713001100,
    }

    const result = extractInboundMessage(rawMsg, { channelId, inboxId, isEcho: true })

    expect(result).not.toBeNull()
    expect(result?.isRevoke).toBe(true)
    expect(result?.targetExternalId).toBe('OUTGOING_MSG_TO_REVOKE_001')
    expect(result?.isEcho).toBe(true)
  })

  it('should return null for protocolMessage type 0 without a targetExternalId', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: false,
        id: 'REVOKE_NO_TARGET',
      },
      message: {
        protocolMessage: {
          key: {
            remoteJid: '628123456789@s.whatsapp.net',
            fromMe: false,
            id: null,
          },
          type: 0,
        },
      },
      messageTimestamp: 1713001200,
    }

    const result = extractInboundMessage(rawMsg, { channelId, inboxId })
    expect(result).toBeNull()
  })

  it('should NOT treat type 14 (edit) protocolMessage as revoke', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: false,
        id: 'EDIT_CONTAINER_SHOULD_NOT_BE_REVOKE',
      },
      message: {
        protocolMessage: {
          key: {
            remoteJid: '628123456789@s.whatsapp.net',
            fromMe: false,
            id: 'ORIGINAL_MSG_004',
          },
          type: 14,
          editedMessage: {
            conversation: 'Edited text',
          },
        },
      },
      messageTimestamp: 1713001300,
    }

    const result = extractInboundMessage(rawMsg, { channelId, inboxId })
    expect(result).not.toBeNull()
    expect(result?.isRevoke).toBeUndefined()
    expect(result?.isEdit).toBe(true)
  })
})
