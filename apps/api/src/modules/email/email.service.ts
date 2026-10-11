import crypto from 'node:crypto'
import nodemailer from 'nodemailer'

export interface EmailAddress {
  address: string
  name: string | null
}

export interface InboundEmailPayload {
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  messageId?: string
  inReplyTo?: string | null
  references?: string[] | string | null
  date?: string | Date
}

export interface ParsedInboundEmail {
  from: EmailAddress
  to: string
  subject: string
  rawText?: string
  rawHtml?: string
  cleanedText: string
  cleanedHtml?: string
  messageId?: string
  inReplyTo?: string | null
  references?: string[]
  ticketIdentifier?: string | null
  date?: string | Date
}

export interface SendEmailOptions {
  from?: string
  to: string
  subject: string
  text: string
  html?: string
  messageId?: string
  inReplyTo?: string | null
  references?: string[] | string | null
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  response?: string
  error?: string
}

export interface EmailTransportLike {
  sendMail: (mailOptions: Record<string, unknown>) => Promise<{
    messageId?: string
    response?: string
  }>
}

export interface EmailSenderConfig {
  transporter?: EmailTransportLike
  defaultFrom?: string
  smtpHost?: string
  smtpPort?: number
  smtpUsername?: string
  smtpPassword?: string
}

/**
 * Ekstraksi alamat email dan display name dari string seperti:
 * "Budi Santoso <budi.santoso@example.com>" atau "support@domain.com"
 */
export function extractEmailAddress(rawFrom: string): EmailAddress {
  if (!rawFrom) {
    return { address: '', name: null }
  }

  const match = rawFrom.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/)
  if (match) {
    const name = match[1]?.trim() || null
    const address = match[2]?.trim() || ''
    return { address, name }
  }

  return {
    address: rawFrom.trim(),
    name: null,
  }
}

/**
 * Ekstraksi identifier tiket dari subject email
 * Misal: "Re: [Ticket #1055] Permintaan refund" -> "1055"
 */
export function extractTicketIdentifier(subject: string): string | null {
  if (!subject) return null

  const match = subject.match(/\[(?:ticket|tiket)?[\s#\-_]*([0-9a-zA-Z]+)\]/i)
  if (match) {
    return match[1]
  }

  return null
}

/**
 * Membersihkan kutipan balasan email (quote stripping)
 * Mendukung format reply Gmail, Outlook, Apple Mail, dan format Indonesia.
 */
export function stripEmailQuotes(content: string, options?: { isHtml?: boolean }): string {
  if (!content) return ''

  if (options?.isHtml) {
    // Strip HTML email quote containers
    const cleanedHtml = content
      .replace(/<div[^>]*class=["'][^"']*gmail_quote[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(
        /<div[^>]*id=["'][^"']*mail-editor-reference-message-container[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
        '',
      )
      .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<hr[^>]*id=["'][^"']*stopSpelling[^"']*["'][^>]*>[\s\S]*/gi, '')

    return cleanedHtml.trim()
  }

  // Pola header balasan email standar (multi-bahasa & multi-klien)
  const quoteHeaderPatterns = [
    // Gmail / Apple Mail / Standard: "On Wed, Oct 11, 2026 ... wrote:"
    /(?:\r?\n|^)\s*On\s+.+?\s+wrote:\s*/i,
    // Format Bahasa Indonesia: "Pada tanggal ... menulis:"
    /(?:\r?\n|^)\s*Pada\s+tanggal\s+.+?\s+menulis:\s*/i,
    // Outlook / Exchange: "-----Original Message-----"
    /(?:\r?\n|^)\s*-{3,}\s*Original Message\s*-{3,}/i,
    // Garis pemisah underscore Outlook web: "________________________________"
    /(?:\r?\n|^)\s*_{10,}/,
    // From / Sent block
    /(?:\r?\n|^)\s*From:\s+.+?\r?\nSent:\s+/i,
  ]

  let cleaned = content

  for (const pattern of quoteHeaderPatterns) {
    const match = cleaned.search(pattern)
    if (match !== -1) {
      cleaned = cleaned.substring(0, match)
    }
  }

  // Buang baris yang dimulai dengan '>' (quoted lines)
  const lines = cleaned.split(/\r?\n/)
  const filteredLines: string[] = []
  for (const line of lines) {
    if (line.trim().startsWith('>')) {
      continue
    }
    filteredLines.push(line)
  }

  return filteredLines.join('\n').trim()
}

/**
 * Parse raw inbound email payload
 */
export function parseInboundEmail(payload: InboundEmailPayload): ParsedInboundEmail {
  const from = extractEmailAddress(payload.from)
  const ticketIdentifier = extractTicketIdentifier(payload.subject)
  const cleanedText = stripEmailQuotes(payload.text || '')
  const cleanedHtml = payload.html ? stripEmailQuotes(payload.html, { isHtml: true }) : undefined

  let referencesList: string[] = []
  if (Array.isArray(payload.references)) {
    referencesList = payload.references
  } else if (typeof payload.references === 'string' && payload.references.trim()) {
    referencesList = payload.references.trim().split(/\s+/)
  }

  return {
    from,
    to: payload.to,
    subject: payload.subject,
    rawText: payload.text,
    rawHtml: payload.html,
    cleanedText,
    cleanedHtml,
    messageId: payload.messageId,
    inReplyTo: payload.inReplyTo,
    references: referencesList.length > 0 ? referencesList : undefined,
    ticketIdentifier,
    date: payload.date,
  }
}

/**
 * Outbound Email Sender Service via SMTP / Nodemailer
 */
export class EmailSenderService {
  private transporter: EmailTransportLike
  private defaultFrom: string

  constructor(config?: EmailSenderConfig) {
    this.defaultFrom = config?.defaultFrom || 'support@xatxoot.com'

    if (config?.transporter) {
      this.transporter = config.transporter
    } else if (config?.smtpHost) {
      const nmTransport = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: (config.smtpPort || 587) === 465,
        auth:
          config.smtpUsername && config.smtpPassword
            ? {
                user: config.smtpUsername,
                pass: config.smtpPassword,
              }
            : undefined,
      })
      this.transporter = {
        sendMail: async (mailOptions: Record<string, unknown>) => {
          const res = await nmTransport.sendMail(
            mailOptions as Parameters<typeof nmTransport.sendMail>[0],
          )
          return { messageId: res.messageId, response: res.response }
        },
      }
    } else {
      // Stub transporter fallback
      this.transporter = {
        sendMail: async (options: Record<string, unknown>) => ({
          messageId: (options.messageId as string) || `<${crypto.randomUUID()}@xatxoot.com>`,
          response: '250 OK (Stub)',
        }),
      }
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const from = options.from || this.defaultFrom
      const messageId =
        options.messageId ||
        `<${crypto.randomUUID()}@${from.split('@')[1]?.replace(/>$/, '') || 'xatxoot.com'}>`

      // Format references
      let referencesStr: string | undefined
      if (Array.isArray(options.references)) {
        referencesStr = options.references.join(' ')
      } else if (typeof options.references === 'string' && options.references.trim()) {
        referencesStr = options.references.trim()
      } else if (options.inReplyTo) {
        referencesStr = options.inReplyTo
      }

      const headers: Record<string, string> = {}
      if (options.inReplyTo) {
        headers['In-Reply-To'] = options.inReplyTo
      }
      if (referencesStr) {
        headers.References = referencesStr
      }

      const mailOptions = {
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        messageId,
        inReplyTo: options.inReplyTo || undefined,
        references: referencesStr,
        headers,
      }

      const result = await this.transporter.sendMail(mailOptions)

      return {
        success: true,
        messageId: result.messageId || messageId,
        response: result.response,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal mengirim email outbound'
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}

/**
 * Email Orchestration Service
 */
export class EmailService {
  private sender: EmailSenderService

  constructor(sender?: EmailSenderService) {
    this.sender = sender || new EmailSenderService()
  }

  async processInboundEmail(payload: InboundEmailPayload) {
    const parsed = parseInboundEmail(payload)

    return {
      senderEmail: parsed.from.address,
      senderName: parsed.from.name,
      cleanedContent: parsed.cleanedText,
      messageId: parsed.messageId,
      inReplyTo: parsed.inReplyTo,
      references: parsed.references,
      subject: parsed.subject,
      ticketIdentifier: parsed.ticketIdentifier,
      contentType: 'incoming_email',
    }
  }

  async sendReplyEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.sender.sendEmail(options)
  }
}
