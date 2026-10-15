import {
  type SendWaMessageJobPayload,
  SendWaMessageJobPayloadSchema,
  type SendWaReactionJobPayload,
  SendWaReactionJobPayloadSchema,
} from '../types/queue'
import type { BaileysConnectionManager } from './baileys-connection-manager'
import type { RedisEventPublisher } from './redis-publisher'

export interface OutboundDispatcherOptions {
  connectionManager: BaileysConnectionManager
  redisPublisher?: RedisEventPublisher
}

export interface DispatchResult {
  success: boolean
  externalMessageId: string
}

export class OutboundMessageDispatcher {
  private connectionManager: BaileysConnectionManager
  private redisPublisher?: RedisEventPublisher

  constructor(options: OutboundDispatcherOptions) {
    this.connectionManager = options.connectionManager
    this.redisPublisher = options.redisPublisher
  }

  private findSession(channelId?: string) {
    const sessions = this.connectionManager.getAllSessions()
    if (channelId) {
      const match = sessions.find(
        (s) =>
          (s.channelId === channelId ||
            s.sessionId === channelId ||
            s.sessionId.includes(channelId) ||
            channelId.includes(s.sessionId)) &&
          s.status === 'connected' &&
          s.socket != null,
      )
      if (match) return match
    }

    const connectedSessions = sessions.filter((s) => s.status === 'connected' && s.socket != null)
    if (connectedSessions.length === 1) {
      return connectedSessions[0]
    }

    return undefined
  }

  async sendMessage(payload: SendWaMessageJobPayload): Promise<DispatchResult> {
    const validated = SendWaMessageJobPayloadSchema.parse(payload)
    const session = this.findSession(validated.channelId)

    if (!session || !session.socket) {
      throw new Error(`No connected Baileys session for channel ${validated.channelId}`)
    }

    const cleanNumber = validated.recipientNumber.replace(/@.*$/, '').replace(/\D/g, '')
    const jid = `${cleanNumber}@s.whatsapp.net`
    const content: Record<string, unknown> = {}

    if (validated.messageType === 'text') {
      content.text = validated.text || ''
    } else if (['image', 'video', 'audio', 'document'].includes(validated.messageType)) {
      if (validated.mediaUrl) {
        content[validated.messageType] = { url: validated.mediaUrl }
      }
      if (validated.text) {
        content.caption = validated.text
      }
      if (validated.fileName && validated.messageType === 'document') {
        content.fileName = validated.fileName
      }
    }

    const socket = session.socket as {
      sendMessage: (
        jid: string,
        content: Record<string, unknown>,
      ) => Promise<{ key?: { id?: string } }>
    }

    const sent = await socket.sendMessage(jid, content)
    const externalMessageId = sent?.key?.id || `WAM_OUT_${Date.now()}`

    if (this.redisPublisher) {
      await this.redisPublisher.publishMessageStatus({
        externalMessageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      })
    }

    return {
      success: true,
      externalMessageId,
    }
  }

  async sendReaction(payload: SendWaReactionJobPayload): Promise<DispatchResult> {
    const validated = SendWaReactionJobPayloadSchema.parse(payload)
    const session = this.findSession(validated.channelId)

    if (!session || !session.socket) {
      throw new Error(`No connected Baileys session for channel ${validated.channelId}`)
    }

    const cleanNumber = validated.recipientNumber.replace(/@.*$/, '').replace(/\D/g, '')
    const jid = `${cleanNumber}@s.whatsapp.net`
    const content = {
      react: {
        text: validated.emoji,
        key: {
          remoteJid: jid,
          id: validated.targetExternalMessageId,
        },
      },
    }

    const socket = session.socket as {
      sendMessage: (
        jid: string,
        content: Record<string, unknown>,
      ) => Promise<{ key?: { id?: string } }>
    }

    const sent = await socket.sendMessage(jid, content)
    const externalMessageId = sent?.key?.id || validated.targetExternalMessageId

    return {
      success: true,
      externalMessageId,
    }
  }
}
