import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface RawMessageDumperOptions {
  dumpsDir?: string
  enabled?: boolean
  retentionDays?: number
}

export class RawMessageDumper {
  readonly dumpsDir: string
  readonly enabled: boolean
  readonly retentionDays: number
  private pendingWrites: Promise<void>[] = []

  constructor(options: RawMessageDumperOptions = {}) {
    this.dumpsDir = options.dumpsDir || './data/dumps'
    this.enabled =
      options.enabled !== undefined
        ? options.enabled
        : process.env.WA_GATEWAY_DUMP_MESSAGES !== 'false'
    this.retentionDays =
      options.retentionDays !== undefined
        ? options.retentionDays
        : Number(process.env.WA_GATEWAY_DUMP_RETENTION_DAYS || 14)

    if (this.enabled && !existsSync(this.dumpsDir)) {
      try {
        mkdirSync(this.dumpsDir, { recursive: true })
      } catch {
        // Directory creation fallback
      }
    }
  }

  shouldIgnore(message: unknown): boolean {
    if (!message || typeof message !== 'object') {
      return true
    }

    // biome-ignore lint/suspicious/noExplicitAny: inspect message key
    const anyMsg = message as any
    const remoteJid = String(anyMsg?.key?.remoteJid || '')

    // Ignore status broadcast / WhatsApp stories
    if (remoteJid === 'status@broadcast' || remoteJid.includes('@broadcast')) {
      return true
    }

    // Group messages (@g.us), 1-on-1 (@s.whatsapp.net, @lid), and outgoing (fromMe) are all preserved
    return false
  }

  private getDailyFilePath(date: Date = new Date()): string {
    const dateStr = date.toISOString().slice(0, 10)
    return join(this.dumpsDir, `raw-messages-${dateStr}.jsonl`)
  }

  async dumpMessage(sessionId: string, message: unknown): Promise<boolean> {
    if (!this.enabled || this.shouldIgnore(message)) {
      return false
    }

    const record = {
      timestamp: new Date().toISOString(),
      sessionId,
      message,
    }

    const line = `${JSON.stringify(record)}\n`
    const filePath = this.getDailyFilePath()

    const writePromise = (async () => {
      try {
        if (!existsSync(this.dumpsDir)) {
          mkdirSync(this.dumpsDir, { recursive: true })
        }
        await appendFile(filePath, line, 'utf8')
      } catch (err) {
        console.error('[wa-gateway] Failed to append raw message dump:', err)
      }
    })()

    this.pendingWrites.push(writePromise)
    await writePromise
    return true
  }

  async dumpMessages(sessionId: string, messages: unknown[]): Promise<number> {
    if (!this.enabled || !Array.isArray(messages) || messages.length === 0) {
      return 0
    }

    const lines: string[] = []
    const now = new Date().toISOString()

    for (const msg of messages) {
      if (!this.shouldIgnore(msg)) {
        lines.push(
          JSON.stringify({
            timestamp: now,
            sessionId,
            message: msg,
          }),
        )
      }
    }

    if (lines.length === 0) {
      return 0
    }

    const batchContent = `${lines.join('\n')}\n`
    const filePath = this.getDailyFilePath()

    const writePromise = (async () => {
      try {
        if (!existsSync(this.dumpsDir)) {
          mkdirSync(this.dumpsDir, { recursive: true })
        }
        await appendFile(filePath, batchContent, 'utf8')
      } catch (err) {
        console.error('[wa-gateway] Failed to append raw messages batch dump:', err)
      }
    })()

    this.pendingWrites.push(writePromise)
    await writePromise
    return lines.length
  }

  async flush(): Promise<void> {
    await Promise.all(this.pendingWrites)
    this.pendingWrites = []
  }

  async purgeExpiredDumps(): Promise<number> {
    if (!existsSync(this.dumpsDir)) {
      return 0
    }

    let purgedCount = 0
    const now = Date.now()
    const maxAgeMs = this.retentionDays * 24 * 60 * 60 * 1000

    try {
      const entries = readdirSync(this.dumpsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          const match = entry.name.match(/^raw-messages-(\d{4}-\d{2}-\d{2})\.jsonl$/)
          if (match) {
            const fileDate = new Date(`${match[1]}T00:00:00.000Z`).getTime()
            if (!Number.isNaN(fileDate) && now - fileDate > maxAgeMs) {
              const fullPath = join(this.dumpsDir, entry.name)
              try {
                rmSync(fullPath, { force: true })
                purgedCount++
              } catch (err) {
                console.error(`[wa-gateway] Failed to purge old dump ${entry.name}:`, err)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[wa-gateway] Failed to scan dumps directory for purge:', err)
    }

    return purgedCount
  }
}

export const rawMessageDumper = new RawMessageDumper()
