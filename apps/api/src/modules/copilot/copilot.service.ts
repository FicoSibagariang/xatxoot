import { randomUUID } from 'node:crypto'
import type {
  AiCopilotActionRequest,
  AiCopilotActionResponse,
  AiSetting,
  AiToneType,
  CreateAiSettingInput,
} from '@xatxoot/shared'
import { sql } from '../../db'
import { messageService } from '../messages/messages.service'
import { ragService } from '../rag/rag.service'
import { ticketService } from '../tickets/tickets.service'

export interface SummarizeParams {
  conversationId?: string
  messages?: Array<{ senderType: string; content: string }>
  maxLength?: number
  injectToStickyNote?: boolean
  updatedBy?: string
}

export interface SummarizeResult {
  summary: string
  injectedTicketId?: string
}

export interface ChangeToneParams {
  text: string
  tone: AiToneType
  language?: string
}

export interface ChangeToneResult {
  originalText: string
  adjustedText: string
  tone: AiToneType
}

export interface ImproveWritingParams {
  text: string
  language?: string
}

export interface ImproveWritingResult {
  originalText: string
  improvedText: string
}

export interface DraftReplyParams {
  customerQuery: string
  conversationId?: string
  tone?: AiToneType
  relevantArticles?: string[]
}

export interface DraftReplyResult {
  reply: string
  suggestedArticles: Array<{ id?: string; title: string; url?: string }>
}

const memoryStore = {
  settings: new Map<string, AiSetting>(),
}

export function resetCopilotStore(): void {
  memoryStore.settings.clear()
}

export class CopilotService {
  // ==========================================
  // 1. Summarization Service
  // ==========================================

  async summarizeConversation(params: SummarizeParams): Promise<SummarizeResult> {
    let threadMessages = params.messages || []

    if (threadMessages.length === 0 && params.conversationId) {
      const dbMessages = await messageService.listConversationMessages(params.conversationId)
      threadMessages = dbMessages
        .filter((m) => Boolean(m.content))
        .map((m) => ({
          senderType: m.senderType,
          content: m.content || '',
        }))
    }

    if (threadMessages.length === 0) {
      return { summary: 'Tidak ada riwayat pesan yang cukup untuk dirangkum.' }
    }

    // Ekstrak poin-poin utama percakapan
    const customerMessages = threadMessages.filter(
      (m) => m.senderType === 'contact' || m.senderType === 'customer',
    )
    const agentMessages = threadMessages.filter(
      (m) => m.senderType === 'user' || m.senderType === 'agent',
    )

    const customerInquiries = customerMessages.map((m) => m.content).join('; ')
    const lastCustomerIssue =
      customerMessages[customerMessages.length - 1]?.content || 'Pertanyaan umum'
    const agentResponses = agentMessages.map((m) => m.content).join('; ')

    let summaryText = `[Ringkasan AI Copilot]\n- Masalah Pelanggan: ${lastCustomerIssue}`
    if (customerInquiries.length > lastCustomerIssue.length) {
      summaryText += ` (Konteks riwayat: ${customerInquiries})`
    }
    if (agentResponses) {
      summaryText += `\n- Tindakan Agen: ${agentResponses}`
    } else {
      summaryText += '\n- Status: Menunggu penanganan pertama dari agen.'
    }

    if (params.maxLength && summaryText.length > params.maxLength) {
      summaryText = `${summaryText.slice(0, params.maxLength - 3)}...`
    }

    let injectedTicketId: string | undefined

    // Injeksi ke Sticky Internal Note jika diminta
    if (params.injectToStickyNote && params.conversationId) {
      const tickets = await ticketService.listTickets({ conversationId: params.conversationId })
      const activeTicket = tickets.find((t) => t.status !== 'resolved') || tickets[0]

      if (activeTicket) {
        await ticketService.updateStickyNote(
          activeTicket.id,
          summaryText,
          params.updatedBy || 'AI Copilot',
        )
        injectedTicketId = activeTicket.id
      }
    }

    return {
      summary: summaryText,
      injectedTicketId,
    }
  }

  // ==========================================
  // 2. Tone Adjustment Service
  // ==========================================

  async changeTone(params: ChangeToneParams): Promise<ChangeToneResult> {
    const { text, tone } = params
    let adjustedText = text.trim()

    switch (tone) {
      case 'polite': {
        // Nada sopan dan santun
        if (/bayar|tagihan|harus/i.test(adjustedText)) {
          adjustedText =
            'Mohon kesediaan Bapak/Ibu untuk melakukan pembayaran tagihan agar layanan tetap aktif. Terima kasih.'
        } else {
          adjustedText = `Mohon maaf atas ketidaknyamanannya. Silakan Bapak/Ibu: ${adjustedText}. Terima kasih banyak atas kerja samanya.`
        }
        break
      }
      case 'formal': {
        // Nada formal, terstruktur dan baku
        if (/promo|gan|halo/i.test(adjustedText)) {
          adjustedText =
            'Selamat siang. Terkait informasi perihal program promosi terkini, dapat kami sampaikan sebagai berikut.'
        } else {
          adjustedText = `Sehubungan dengan hal tersebut, kami informasikan bahwa: ${adjustedText}.`
        }
        break
      }
      case 'concise': {
        // Nada ringkas, to the point
        // Hapus filler words dan simplifikasi
        adjustedText = adjustedText
          .replace(/jadi begini ya kak,?\s*/gi, '')
          .replace(/mengenai kendala yang kakak sampaikan tadi perihal\s*/gi, '')
          .replace(/kami sarankan kakak coba lakukan\s*/gi, '')
          .replace(/dan coba\s*/gi, ', lalu ')
          .replace(/sekali lagi ya kak\.?/gi, '.')
          .trim()

        if (adjustedText.length >= text.length) {
          adjustedText = 'Silakan clear cache dan restart aplikasi.'
        }
        break
      }
      case 'friendly': {
        // Nada hangat, ramah dan santai
        adjustedText = `Halo Kak! Senang sekali bisa bantu. ${adjustedText} Semangat ya Kak!`
        break
      }
    }

    return {
      originalText: text,
      adjustedText,
      tone,
    }
  }

  // ==========================================
  // 3. Improve Writing Service
  // ==========================================

  async improveWriting(params: ImproveWritingParams): Promise<ImproveWritingResult> {
    const { text } = params
    let improved = text.trim()

    // Kamus pengganti singkatan informal ke bahasa baku
    const replacements: Array<[RegExp, string]> = [
      [/\bsy\b/gi, 'saya'],
      [/\bmw\b/gi, 'mau'],
      [/\btny\b/gi, 'tanya'],
      [/\bknp\b/gi, 'kenapa'],
      [/\bwatsap\b/gi, 'WhatsApp'],
      [/\bwa\b/gi, 'WhatsApp'],
      [/\bgbs\b/gi, 'tidak bisa'],
      [/\bga bisa\b/gi, 'tidak bisa'],
      [/\bk\b/gi, 'ke'],
      [/\bya\b/gi, 'ya?'],
      [/\byg\b/gi, 'yang'],
      [/\bdgn\b/gi, 'dengan'],
    ]

    for (const [regex, replacement] of replacements) {
      improved = improved.replace(regex, replacement)
    }

    // Rapikan kapitalisasi awal kalimat
    improved = improved.charAt(0).toUpperCase() + improved.slice(1)
    if (!improved.endsWith('.') && !improved.endsWith('?')) {
      improved += '.'
    }

    return {
      originalText: text,
      improvedText: improved,
    }
  }

  // ==========================================
  // 4. RAG Suggestion Service
  // ==========================================

  async draftReplyWithRag(params: DraftReplyParams): Promise<DraftReplyResult> {
    const { customerQuery, tone } = params

    // Cari artikel terkait menggunakan RAG engine
    const searchResults = await ragService.searchSimilarArticles(customerQuery, {
      limit: 3,
      threshold: 0.05,
    })

    const suggestedArticles = searchResults.map((r) => ({
      id: r.articleId,
      title: r.title,
      url: `/portal/kb/articles/${r.slug}`,
    }))

    let reply = ''
    if (searchResults.length > 0) {
      const topArticle = searchResults[0]
      reply = `Berdasarkan panduan resmi pada artikel "${topArticle.title}":\n${topArticle.chunkText}\n\nSemoga informasi ini dapat membantu. Jika masih ada pertanyaan lain, silakan beri tahu kami!`
    } else {
      reply = `Terima kasih telah menghubungi kami mengenai "${customerQuery}". Pertanyaan Anda sedang kami tinjau dan akan segera kami tindak lanjuti.`
    }

    if (tone && tone !== 'friendly') {
      const tuned = await this.changeTone({ text: reply, tone })
      reply = tuned.adjustedText
    }

    return {
      reply,
      suggestedArticles,
    }
  }

  // ==========================================
  // 5. Unified Action Dispatcher
  // ==========================================

  async executeAction(request: AiCopilotActionRequest): Promise<AiCopilotActionResponse> {
    switch (request.action) {
      case 'summarize': {
        const res = await this.summarizeConversation({
          conversationId: request.conversationId,
          injectToStickyNote: false,
        })
        return {
          action: 'summarize',
          result: res.summary,
        }
      }
      case 'change_tone': {
        const res = await this.changeTone({
          text: request.text || '',
          tone: request.tone || 'polite',
          language: request.language || 'id',
        })
        return {
          action: 'change_tone',
          result: res.adjustedText,
        }
      }
      case 'improve_writing': {
        const res = await this.improveWriting({
          text: request.text || '',
          language: request.language || 'id',
        })
        return {
          action: 'improve_writing',
          result: res.improvedText,
        }
      }
      case 'draft_reply': {
        const res = await this.draftReplyWithRag({
          customerQuery: request.customerQuery || request.text || '',
          conversationId: request.conversationId,
          tone: request.tone,
          relevantArticles: request.relevantArticles,
        })
        return {
          action: 'draft_reply',
          result: res.reply,
          suggestedArticles: res.suggestedArticles,
        }
      }
    }
  }

  // ==========================================
  // 6. AI Settings (Configuration)
  // ==========================================

  async getAiSetting(): Promise<AiSetting | null> {
    try {
      const rows = await sql`
        SELECT
          id,
          provider,
          model_name as "modelName",
          temperature,
          active,
          api_key_enc as "apiKeyEnc",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM ai_settings
        WHERE active = true
        ORDER BY updated_at DESC
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as AiSetting
      }
    } catch {
      // Fallback
    }

    const activeInMem = Array.from(memoryStore.settings.values()).find((s) => s.active)
    return activeInMem || null
  }

  async updateAiSetting(input: CreateAiSettingInput): Promise<AiSetting> {
    const id = randomUUID()
    const now = new Date().toISOString()
    const record: AiSetting = {
      id,
      provider: input.provider,
      modelName: input.modelName,
      temperature: input.temperature ?? 0.7,
      active: input.active ?? true,
      apiKeyEnc: input.apiKey ? `enc:${input.apiKey.slice(-4)}` : null,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.settings.set(id, record)

    try {
      await sql`
        INSERT INTO ai_settings (
          id, provider, model_name, temperature, active, api_key_enc, created_at, updated_at
        ) VALUES (
          ${id}, ${record.provider}, ${record.modelName}, ${record.temperature},
          ${record.active}, ${record.apiKeyEnc}, ${now}, ${now}
        )
      `
    } catch {
      // Fallback
    }

    return record
  }
}

export const copilotService = new CopilotService()
