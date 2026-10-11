export interface TelegramAttachment {
  fileId: string
  fileType: 'image' | 'file' | 'audio' | 'video'
  fileName?: string
  mimeType?: string
  fileSize?: number
  width?: number
  height?: number
}

export interface ParsedTelegramUpdate {
  type: 'message' | 'callback_query'
  messageId: string
  chatId: string
  senderId: string
  senderName: string
  senderUsername?: string
  contentType: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive'
  content: string
  replyToMessageId: string | null
  callbackQueryId?: string
  attachments: TelegramAttachment[]
  date: number
}

export interface SendMessageOptions {
  chatId: string | number
  text: string
  replyToMessageId?: string | number
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML'
}

export interface SendPhotoOptions {
  chatId: string | number
  photo: string
  caption?: string
  replyToMessageId?: string | number
}

export interface SendDocumentOptions {
  chatId: string | number
  document: string
  caption?: string
  replyToMessageId?: string | number
}

export interface AnswerCallbackQueryOptions {
  callbackQueryId: string
  text?: string
  showAlert?: boolean
}

export interface TelegramApiResult {
  success: boolean
  messageId?: string
  response?: Record<string, unknown>
  error?: string
}

export type TelegramFetcher = (
  url: string,
  options?: RequestInit,
) => Promise<{
  ok: boolean
  status?: number
  json: () => Promise<Record<string, unknown>>
}>

export interface TelegramSenderConfig {
  botToken: string
  fetcher?: TelegramFetcher
  baseUrl?: string
}

/**
 * Parsing payload Telegram Webhook Update object
 */
export function parseTelegramUpdate(update: Record<string, unknown>): ParsedTelegramUpdate | null {
  if (!update || typeof update !== 'object') {
    return null
  }

  // 1. Handle callback_query update
  if (update.callback_query && typeof update.callback_query === 'object') {
    const cb = update.callback_query as Record<string, unknown>
    const from = (cb.from || {}) as Record<string, unknown>
    const msg = (cb.message || {}) as Record<string, unknown>
    const chat = (msg.chat || from) as Record<string, unknown>

    const firstName = typeof from.first_name === 'string' ? from.first_name : ''
    const lastName = typeof from.last_name === 'string' ? from.last_name : ''
    const senderName = [firstName, lastName].filter(Boolean).join(' ') || 'Telegram User'

    return {
      type: 'callback_query',
      messageId: msg.message_id ? String(msg.message_id) : String(cb.id),
      chatId: String(chat.id || from.id),
      senderId: String(from.id),
      senderName,
      senderUsername: typeof from.username === 'string' ? from.username : undefined,
      contentType: 'interactive',
      content: typeof cb.data === 'string' ? cb.data : '',
      replyToMessageId: null,
      callbackQueryId: String(cb.id),
      attachments: [],
      date: typeof msg.date === 'number' ? msg.date : Math.floor(Date.now() / 1000),
    }
  }

  // 2. Handle standard message update
  if (update.message && typeof update.message === 'object') {
    const msg = update.message as Record<string, unknown>
    const from = (msg.from || {}) as Record<string, unknown>
    const chat = (msg.chat || from) as Record<string, unknown>

    const firstName = typeof from.first_name === 'string' ? from.first_name : ''
    const lastName = typeof from.last_name === 'string' ? from.last_name : ''
    const senderName = [firstName, lastName].filter(Boolean).join(' ') || 'Telegram User'

    const replyToMsg = msg.reply_to_message as Record<string, unknown> | undefined
    const replyToMessageId = replyToMsg?.message_id ? String(replyToMsg.message_id) : null

    const attachments: TelegramAttachment[] = []
    let contentType: ParsedTelegramUpdate['contentType'] = 'text'
    let content = typeof msg.text === 'string' ? msg.text : ''

    if (Array.isArray(msg.photo) && msg.photo.length > 0) {
      contentType = 'image'
      content = typeof msg.caption === 'string' ? msg.caption : ''
      // Ambil photo dengan resolusi tertinggi (item terakhir)
      const bestPhoto = msg.photo[msg.photo.length - 1] as Record<string, unknown>
      attachments.push({
        fileId: String(bestPhoto.file_id),
        fileType: 'image',
        fileSize: typeof bestPhoto.file_size === 'number' ? bestPhoto.file_size : undefined,
        width: typeof bestPhoto.width === 'number' ? bestPhoto.width : undefined,
        height: typeof bestPhoto.height === 'number' ? bestPhoto.height : undefined,
      })
    } else if (msg.document && typeof msg.document === 'object') {
      const doc = msg.document as Record<string, unknown>
      contentType = 'document'
      content = typeof msg.caption === 'string' ? msg.caption : ''
      attachments.push({
        fileId: String(doc.file_id),
        fileType: 'file',
        fileName: typeof doc.file_name === 'string' ? doc.file_name : undefined,
        mimeType: typeof doc.mime_type === 'string' ? doc.mime_type : undefined,
        fileSize: typeof doc.file_size === 'number' ? doc.file_size : undefined,
      })
    } else if (msg.audio && typeof msg.audio === 'object') {
      const aud = msg.audio as Record<string, unknown>
      contentType = 'audio'
      content = typeof msg.caption === 'string' ? msg.caption : ''
      attachments.push({
        fileId: String(aud.file_id),
        fileType: 'audio',
        fileName: typeof aud.file_name === 'string' ? aud.file_name : undefined,
        mimeType: typeof aud.mime_type === 'string' ? aud.mime_type : undefined,
        fileSize: typeof aud.file_size === 'number' ? aud.file_size : undefined,
      })
    } else if (msg.video && typeof msg.video === 'object') {
      const vid = msg.video as Record<string, unknown>
      contentType = 'video'
      content = typeof msg.caption === 'string' ? msg.caption : ''
      attachments.push({
        fileId: String(vid.file_id),
        fileType: 'video',
        fileName: typeof vid.file_name === 'string' ? vid.file_name : undefined,
        mimeType: typeof vid.mime_type === 'string' ? vid.mime_type : undefined,
        fileSize: typeof vid.file_size === 'number' ? vid.file_size : undefined,
        width: typeof vid.width === 'number' ? vid.width : undefined,
        height: typeof vid.height === 'number' ? vid.height : undefined,
      })
    }

    return {
      type: 'message',
      messageId: String(msg.message_id),
      chatId: String(chat.id),
      senderId: String(from.id),
      senderName,
      senderUsername: typeof from.username === 'string' ? from.username : undefined,
      contentType,
      content,
      replyToMessageId,
      attachments,
      date: typeof msg.date === 'number' ? msg.date : Math.floor(Date.now() / 1000),
    }
  }

  return null
}

/**
 * Service pengiriman pesan outbound ke Telegram Bot API
 */
export class TelegramSenderService {
  private botToken: string
  private baseUrl: string
  private fetcher: TelegramFetcher

  constructor(config: TelegramSenderConfig) {
    this.botToken = config.botToken
    this.baseUrl = config.baseUrl || 'https://api.telegram.org'
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

  private async callApi(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<TelegramApiResult> {
    try {
      const url = `${this.baseUrl}/bot${this.botToken}/${method}`
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok || !data.ok) {
        const desc =
          typeof data.description === 'string'
            ? data.description
            : `Telegram API error (${response.status || 'unknown'})`
        return {
          success: false,
          error: desc,
        }
      }

      const resObj = data.result as Record<string, unknown> | undefined
      const messageId = resObj?.message_id ? String(resObj.message_id) : undefined

      return {
        success: true,
        messageId,
        response: resObj,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal menghubungi Telegram Bot API'
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<TelegramApiResult> {
    const payload: Record<string, unknown> = {
      chat_id: options.chatId,
      text: options.text,
    }
    if (options.parseMode) {
      payload.parse_mode = options.parseMode
    }
    if (options.replyToMessageId) {
      payload.reply_to_message_id = Number(options.replyToMessageId)
    }

    return this.callApi('sendMessage', payload)
  }

  async sendPhoto(options: SendPhotoOptions): Promise<TelegramApiResult> {
    const payload: Record<string, unknown> = {
      chat_id: options.chatId,
      photo: options.photo,
    }
    if (options.caption) {
      payload.caption = options.caption
    }
    if (options.replyToMessageId) {
      payload.reply_to_message_id = Number(options.replyToMessageId)
    }

    return this.callApi('sendPhoto', payload)
  }

  async sendDocument(options: SendDocumentOptions): Promise<TelegramApiResult> {
    const payload: Record<string, unknown> = {
      chat_id: options.chatId,
      document: options.document,
    }
    if (options.caption) {
      payload.caption = options.caption
    }
    if (options.replyToMessageId) {
      payload.reply_to_message_id = Number(options.replyToMessageId)
    }

    return this.callApi('sendDocument', payload)
  }

  async answerCallbackQuery(options: AnswerCallbackQueryOptions): Promise<TelegramApiResult> {
    const payload: Record<string, unknown> = {
      callback_query_id: options.callbackQueryId,
    }
    if (options.text) {
      payload.text = options.text
    }
    if (options.showAlert !== undefined) {
      payload.show_alert = options.showAlert
    }

    return this.callApi('answerCallbackQuery', payload)
  }
}

/**
 * High-level Telegram Orchestration Service
 */
export class TelegramService {
  private sender: TelegramSenderService

  constructor(config: { botToken: string; sender?: TelegramSenderService }) {
    this.sender =
      config.sender ||
      new TelegramSenderService({
        botToken: config.botToken,
        fetcher: async () => {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: { message_id: Math.floor(Math.random() * 10000) },
            }),
          }
        },
      })
  }

  async processWebhookUpdate(update: Record<string, unknown>) {
    const parsed = parseTelegramUpdate(update)
    if (!parsed) {
      return null
    }

    return {
      senderId: parsed.senderId,
      senderName: parsed.senderName,
      senderUsername: parsed.senderUsername,
      chatId: parsed.chatId,
      messageId: parsed.messageId,
      content: parsed.content,
      contentType: parsed.contentType,
      attachments: parsed.attachments,
      replyToMessageId: parsed.replyToMessageId,
      callbackQueryId: parsed.callbackQueryId,
    }
  }

  async sendOutbound(options: SendMessageOptions) {
    return this.sender.sendMessage(options)
  }
}
