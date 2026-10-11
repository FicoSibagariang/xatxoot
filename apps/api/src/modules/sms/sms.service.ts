import { createHmac, timingSafeEqual } from 'node:crypto'

export interface ParsedTwilioInboundSms {
  messageSid: string
  from: string
  to: string
  body: string
  contentType: 'text' | 'image' | 'file'
  mediaUrls: string[]
  accountSid?: string
}

export interface ValidateTwilioSignatureOptions {
  url: string
  params: Record<string, unknown>
  signatureHeader?: string | null
  authToken?: string | null
}

export interface SendSmsOptions {
  to: string
  from?: string
  body: string
  mediaUrl?: string
}

export interface SendSmsResult {
  success: boolean
  messageSid?: string
  response?: Record<string, unknown>
  error?: string
}

export type SmsFetcher = (
  url: string,
  options?: RequestInit,
) => Promise<{
  ok: boolean
  status?: number
  json: () => Promise<Record<string, unknown>>
}>

export interface TwilioSenderConfig {
  accountSid: string
  authToken: string
  defaultFrom?: string
  fetcher?: SmsFetcher
  baseUrl?: string
}

/**
 * Validasi signature webhook Twilio (X-Twilio-Signature)
 * HMAC-SHA1 dari URL + sorted params concatenation
 */
export function validateTwilioSignature(options: ValidateTwilioSignatureOptions): boolean {
  if (!options.signatureHeader || !options.authToken) {
    return false
  }

  const sortedKeys = Object.keys(options.params).sort()
  let dataString = options.url
  for (const key of sortedKeys) {
    const value = options.params[key]
    if (value !== undefined && value !== null) {
      dataString += `${key}${String(value)}`
    }
  }

  const expectedSignature = createHmac('sha1', options.authToken)
    .update(dataString)
    .digest('base64')

  try {
    const receivedBuffer = Buffer.from(options.signatureHeader)
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
 * Parse payload SMS/MMS masuk dari Twilio Webhook
 */
export function parseTwilioInboundSms(
  payload: Record<string, unknown>,
): ParsedTwilioInboundSms | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const from = payload.From ? String(payload.From) : ''
  const to = payload.To ? String(payload.To) : ''

  if (!from || !to) {
    return null
  }

  const messageSid = String(payload.MessageSid || payload.SmsSid || '')
  const body = typeof payload.Body === 'string' ? payload.Body : ''
  const accountSid = payload.AccountSid ? String(payload.AccountSid) : undefined

  const numMedia = Number.parseInt(String(payload.NumMedia || '0'), 10)
  const mediaUrls: string[] = []

  if (!Number.isNaN(numMedia) && numMedia > 0) {
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = payload[`MediaUrl${i}`]
      if (typeof mediaUrl === 'string' && mediaUrl.trim()) {
        mediaUrls.push(mediaUrl.trim())
      }
    }
  }

  let contentType: ParsedTwilioInboundSms['contentType'] = 'text'
  if (mediaUrls.length > 0) {
    contentType = 'image'
  }

  return {
    messageSid,
    from,
    to,
    body,
    contentType,
    mediaUrls,
    accountSid,
  }
}

/**
 * Outbound SMS & MMS Sender Service via Twilio REST API
 */
export class TwilioSenderService {
  private accountSid: string
  private authToken: string
  private defaultFrom: string
  private baseUrl: string
  private fetcher: SmsFetcher

  constructor(config: TwilioSenderConfig) {
    this.accountSid = config.accountSid
    this.authToken = config.authToken
    this.defaultFrom = config.defaultFrom || ''
    this.baseUrl = config.baseUrl || 'https://api.twilio.com/2010-04-01'
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

  async sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
    try {
      const from = options.from || this.defaultFrom
      if (!from) {
        return {
          success: false,
          error: 'Parameter from phone number wajib diisi',
        }
      }

      const url = `${this.baseUrl}/Accounts/${this.accountSid}/Messages.json`
      const basicAuth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')

      const bodyParams = new URLSearchParams()
      bodyParams.set('To', options.to)
      bodyParams.set('From', from)
      bodyParams.set('Body', options.body)
      if (options.mediaUrl) {
        bodyParams.set('MediaUrl', options.mediaUrl)
      }

      const response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      })

      const data = await response.json()
      if (!response.ok) {
        const errorMsg =
          typeof data.message === 'string'
            ? data.message
            : `Twilio API error (${response.status || 'unknown'})`
        return {
          success: false,
          error: errorMsg,
        }
      }

      const messageSid = typeof data.sid === 'string' ? data.sid : undefined

      return {
        success: true,
        messageSid,
        response: data,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal mengirim SMS via Twilio API'
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}

/**
 * High-level SMS Orchestration Service
 */
export class SmsService {
  private sender: TwilioSenderService

  constructor(sender?: TwilioSenderService) {
    this.sender =
      sender ||
      new TwilioSenderService({
        accountSid: 'mock_sms_account_sid_9988',
        authToken: 'mock_token',
        fetcher: async () => ({
          ok: true,
          status: 201,
          json: async () => ({
            sid: 'mock_sms_sent_123',
            status: 'queued',
          }),
        }),
      })
  }

  async processWebhookPayload(payload: Record<string, unknown>) {
    const parsed = parseTwilioInboundSms(payload)
    if (!parsed) {
      return null
    }

    return {
      messageSid: parsed.messageSid,
      from: parsed.from,
      to: parsed.to,
      body: parsed.body,
      contentType: parsed.contentType,
      mediaUrls: parsed.mediaUrls,
    }
  }

  async sendOutbound(options: SendSmsOptions) {
    return this.sender.sendSms(options)
  }
}
