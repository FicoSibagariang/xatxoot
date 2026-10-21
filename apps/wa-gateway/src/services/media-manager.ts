import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type WAMessage, downloadMediaMessage } from '@whiskeysockets/baileys'
import pino from 'pino'

export interface MediaManagerOptions {
  mediaDir?: string
  mediaBaseUrl?: string
}

export interface SavedMediaInfo {
  filename: string
  mimeType: string
  mediaUrl: string
  fileSize: number
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/ogg': 'ogg',
  'audio/ogg; codecs=opus': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

export class MediaManager {
  readonly mediaDir: string
  readonly mediaBaseUrl: string

  constructor(options: MediaManagerOptions = {}) {
    this.mediaDir = options.mediaDir || process.env.WA_GATEWAY_MEDIA_DIR || './data/media'
    this.mediaBaseUrl = options.mediaBaseUrl || process.env.WA_GATEWAY_MEDIA_URL || '/api/v1/media'

    if (!existsSync(this.mediaDir)) {
      try {
        mkdirSync(this.mediaDir, { recursive: true })
      } catch {
        // Directory creation fallback
      }
    }
  }

  getExtension(mimeType: string): string {
    const clean = mimeType.split(';')[0].trim().toLowerCase()
    return MIME_EXTENSION_MAP[clean] || 'bin'
  }

  generateFilename(sessionId: string, messageId: string, mimeType: string): string {
    const ext = this.getExtension(mimeType)
    const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const safeMsgId = messageId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `${safeSession}_${safeMsgId}.${ext}`
  }

  getMediaUrl(filename: string): string {
    return `${this.mediaBaseUrl.replace(/\/+$/, '')}/${filename}`
  }

  async saveMediaBuffer(
    buffer: Buffer,
    sessionId: string,
    messageId: string,
    mimeType: string,
  ): Promise<SavedMediaInfo> {
    const filename = this.generateFilename(sessionId, messageId, mimeType)
    const filePath = join(this.mediaDir, filename)

    writeFileSync(filePath, buffer)

    return {
      filename,
      mimeType,
      mediaUrl: this.getMediaUrl(filename),
      fileSize: buffer.length,
    }
  }

  async downloadAndSave(
    wam: unknown,
    sessionId: string,
    messageId: string,
    socket?: unknown,
  ): Promise<SavedMediaInfo | null> {
    const rawMsg = wam as Record<string, unknown> | null
    if (!rawMsg || typeof rawMsg !== 'object' || !rawMsg.message) {
      return null
    }

    const msgObj = rawMsg.message as Record<string, Record<string, unknown>>
    const mediaContent =
      msgObj.imageMessage ||
      msgObj.videoMessage ||
      msgObj.audioMessage ||
      msgObj.documentMessage ||
      msgObj.stickerMessage

    if (!mediaContent) {
      return null
    }

    const mimeType = (mediaContent.mimetype as string) || 'image/jpeg'

    try {
      const sockWithUpdate = socket as
        | { updateMediaMessage?: (msg: WAMessage) => Promise<WAMessage> }
        | undefined
      const buffer = await downloadMediaMessage(
        wam as WAMessage,
        'buffer',
        {},
        {
          logger: pino({ level: 'silent' }),
          reuploadRequest: (msg: WAMessage) =>
            sockWithUpdate?.updateMediaMessage
              ? sockWithUpdate.updateMediaMessage(msg)
              : Promise.resolve(msg),
        },
      )

      if (!buffer || buffer.length === 0) {
        return null
      }

      return await this.saveMediaBuffer(buffer, sessionId, messageId, mimeType)
    } catch (err) {
      console.warn(
        `[wa-gateway] [${sessionId}] Failed to download media for msg ${messageId}:`,
        (err as Error).message,
      )
      return null
    }
  }
}

export const mediaManager = new MediaManager()
