import { createHmac, timingSafeEqual } from 'node:crypto'

export const DEFAULT_META_SOCIAL_APP_SECRET =
  process.env.META_APP_SECRET || 'meta_social_secret_99887766'
export const DEFAULT_META_SOCIAL_VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN || 'meta_social_verify_token_12345'

export interface MetaSocialAttachment {
  type: 'image' | 'video' | 'audio' | 'file'
  url: string
}

export interface ParsedMetaSocialMessage {
  platform: 'facebook' | 'instagram'
  senderId: string
  recipientId: string
  messageId: string
  content: string
  contentType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'interactive'
  replyToMid: string | null
  attachments: MetaSocialAttachment[]
  timestamp: number
}

export interface SendMetaSocialMessageOptions {
  recipientId: string
  text: string
  replyToMid?: string | null
}

export interface SendMetaSocialMediaOptions {
  recipientId: string
  mediaType: 'image' | 'video' | 'audio' | 'file'
  mediaUrl: string
}

export interface MetaSocialApiResult {
  success: boolean
  messageId?: string
  response?: Record<string, unknown>
  error?: string
}

export type MetaSocialFetcher = (
  url: string,
  options?: RequestInit,
) => Promise<{
  ok: boolean
  status?: number
  json: () => Promise<Record<string, unknown>>
}>

export interface MetaSocialSenderConfig {
  accessToken: string
  fetcher?: MetaSocialFetcher
  graphApiVersion?: string
}

/**
 * Verifikasi signature payload webhook (X-Hub-Signature-256)
 */
export function verifyMetaSocialSignature(
  rawPayload: string,
  signatureHeader?: string | null,
  appSecret?: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  const secret = appSecret || DEFAULT_META_SOCIAL_APP_SECRET
  const expectedHash = createHmac('sha256', secret).update(rawPayload).digest('hex')
  const expectedSignature = `sha256=${expectedHash}`

  try {
    const receivedBuffer = Buffer.from(signatureHeader)
    const expectedBuffer = Buffer.from(expectedSignature)
    if (receivedBuffer.length !== expectedBuffer.length) {
      return false
    }
    return timingSafeEqual(receivedBuffer, expectedBuffer)
  } catch {
    return false
  }
}

/**
 * Verifikasi challenge webhook saat pendaftaran di Meta App Dashboard
 */
export function verifyMetaSocialChallenge(
  queryParams: Record<string, string | undefined>,
  expectedToken?: string,
): string | null {
  const mode = queryParams['hub.mode']
  const token = queryParams['hub.verify_token']
  const challenge = queryParams['hub.challenge']

  if (mode !== 'subscribe') {
    return null
  }

  const verifyToken = expectedToken || DEFAULT_META_SOCIAL_VERIFY_TOKEN
  if (token !== verifyToken) {
    return null
  }

  return challenge || null
}

/**
 * Parsing payload event webhook Meta Social (Facebook Page & Instagram)
 */
export function parseMetaSocialWebhook(
  payload: Record<string, unknown>,
): ParsedMetaSocialMessage[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const objectType = payload.object as string
  if (objectType !== 'page' && objectType !== 'instagram') {
    return []
  }

  const platform: 'facebook' | 'instagram' = objectType === 'instagram' ? 'instagram' : 'facebook'
  const entries = (payload.entry as Array<Record<string, unknown>>) || []
  const parsedMessages: ParsedMetaSocialMessage[] = []

  for (const entry of entries) {
    const messaging = (entry.messaging as Array<Record<string, unknown>>) || []

    for (const msgObj of messaging) {
      const sender = (msgObj.sender || {}) as Record<string, unknown>
      const recipient = (msgObj.recipient || {}) as Record<string, unknown>
      const senderId = String(sender.id || '')
      const recipientId = String(recipient.id || '')
      const timestamp = typeof msgObj.timestamp === 'number' ? msgObj.timestamp : Date.now()

      // 1. Tangani pesan standar (message)
      if (msgObj.message && typeof msgObj.message === 'object') {
        const message = msgObj.message as Record<string, unknown>

        // Abaikan echo message yang dikirimkan oleh page itu sendiri
        if (message.is_echo === true) {
          continue
        }

        const messageId = String(message.mid || '')
        const replyTo = message.reply_to as Record<string, unknown> | undefined
        const replyToMid = replyTo?.mid ? String(replyTo.mid) : null

        const attachments: MetaSocialAttachment[] = []
        let contentType: ParsedMetaSocialMessage['contentType'] = 'text'
        const content = typeof message.text === 'string' ? message.text : ''

        if (Array.isArray(message.attachments) && message.attachments.length > 0) {
          for (const att of message.attachments as Array<Record<string, unknown>>) {
            const attType = (att.type as MetaSocialAttachment['type']) || 'file'
            const attPayload = (att.payload || {}) as Record<string, unknown>
            const attUrl = typeof attPayload.url === 'string' ? attPayload.url : ''

            attachments.push({
              type: attType,
              url: attUrl,
            })
          }

          if (attachments.length > 0) {
            contentType = attachments[0].type
          }
        }

        parsedMessages.push({
          platform,
          senderId,
          recipientId,
          messageId,
          content,
          contentType,
          replyToMid,
          attachments,
          timestamp,
        })
      }
      // 2. Tangani postback button click event
      else if (msgObj.postback && typeof msgObj.postback === 'object') {
        const postback = msgObj.postback as Record<string, unknown>
        const messageId = `postback_${senderId}_${timestamp}`
        const content = String(postback.payload || postback.title || '')

        parsedMessages.push({
          platform,
          senderId,
          recipientId,
          messageId,
          content,
          contentType: 'interactive',
          replyToMid: null,
          attachments: [],
          timestamp,
        })
      }
    }
  }

  return parsedMessages
}

/**
 * Outbound Sender Service untuk Facebook Messenger & Instagram Direct via Graph API
 */
export class MetaSocialSenderService {
  private accessToken: string
  private graphApiVersion: string
  private fetcher: MetaSocialFetcher

  constructor(config: MetaSocialSenderConfig) {
    this.accessToken = config.accessToken
    this.graphApiVersion = config.graphApiVersion || 'v18.0'
    this.fetcher =
      config.fetcher ||
      (async (url: string, options?: RequestInit) => {
        const res = await fetch(url, options)
        const json = (await res.json()) as Record<string, unknown>
        return {
          ok: res.ok,
          status: res.status,
          json: async () => json,
        }
      })
  }

  private async callMessagesApi(payload: Record<string, unknown>): Promise<MetaSocialApiResult> {
    try {
      const url = `https://graph.facebook.com/${this.graphApiVersion}/me/messages`
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        const errObj = data.error as Record<string, unknown> | undefined
        const errorMsg =
          typeof errObj?.message === 'string'
            ? errObj.message
            : `Graph API error (${response.status || 'unknown'})`
        return {
          success: false,
          error: errorMsg,
        }
      }

      const messageId = typeof data.message_id === 'string' ? data.message_id : undefined

      return {
        success: true,
        messageId,
        response: data,
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Gagal mengirim pesan ke Meta Graph API'
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  async sendMessage(options: SendMetaSocialMessageOptions): Promise<MetaSocialApiResult> {
    const messagePayload: Record<string, unknown> = {
      text: options.text,
    }

    if (options.replyToMid) {
      messagePayload.reply_to = {
        mid: options.replyToMid,
      }
    }

    const payload: Record<string, unknown> = {
      recipient: { id: options.recipientId },
      message: messagePayload,
      messaging_type: 'RESPONSE',
    }

    return this.callMessagesApi(payload)
  }

  async sendMediaAttachment(options: SendMetaSocialMediaOptions): Promise<MetaSocialApiResult> {
    const payload: Record<string, unknown> = {
      recipient: { id: options.recipientId },
      message: {
        attachment: {
          type: options.mediaType,
          payload: {
            url: options.mediaUrl,
            is_reusable: true,
          },
        },
      },
      messaging_type: 'RESPONSE',
    }

    return this.callMessagesApi(payload)
  }
}

/**
 * Meta Social High-level Service
 */
export class MetaSocialService {
  private sender: MetaSocialSenderService

  constructor(sender?: MetaSocialSenderService) {
    this.sender =
      sender ||
      new MetaSocialSenderService({
        accessToken: 'mock_token',
        fetcher: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            recipient_id: 'rec_1',
            message_id: 'mid.mock.123',
          }),
        }),
      })
  }

  async processWebhookPayload(payload: Record<string, unknown>) {
    const messages = parseMetaSocialWebhook(payload)
    return {
      success: true,
      processed: messages.length,
      messages,
    }
  }

  async sendMessage(options: SendMetaSocialMessageOptions) {
    return this.sender.sendMessage(options)
  }
}
