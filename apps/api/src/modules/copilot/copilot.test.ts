import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { conversationService, resetConversationStore } from '../conversations/conversations.service'
import { helpCenterService, resetHelpCenterStore } from '../help-center/help-center.service'
import { messageService, resetMessageStore } from '../messages/messages.service'
import { ragService, resetRagStore } from '../rag/rag.service'
import { resetTicketStore, ticketService } from '../tickets/tickets.service'
import { copilotRoutes } from './copilot.routes'
import { CopilotService, copilotService, resetCopilotStore } from './copilot.service'

describe('AI Copilot Services (Task 5.10 - apps/api)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  let app: Hono

  beforeEach(() => {
    resetConversationStore()
    resetMessageStore()
    resetTicketStore()
    resetHelpCenterStore()
    resetRagStore()
    resetCopilotStore()
    app = new Hono()
    app.route('/api/v1/copilot', copilotRoutes)
  })

  describe('1. Summarization Service & Sticky Note Injection', () => {
    it('should summarize a multi-message conversation thread', async () => {
      const { conversation: conv } = await conversationService.handleInboundMessage({
        inboxId: crypto.randomUUID(),
        sourceId: '+6281299990001',
        content: 'Halo, saya mengalami kendala saat upload dokumen invoice format PDF.',
      })

      // Tambahkan rangkaian pesan customer dan agent
      await messageService.saveMessage({
        id: crypto.randomUUID(),
        conversationId: conv.id,
        ticketId: null,
        senderType: 'user',
        senderId: 'agent-1',
        messageType: 'outgoing',
        content: 'Halo! Apakah muncul pesan error ukuran file melebihi 5MB?',
        contentType: 'text',
        status: 'delivered',
        externalSourceId: null,
        contentAttributes: {},
        createdAt: new Date(Date.now() - 200000).toISOString(),
        updatedAt: new Date(Date.now() - 200000).toISOString(),
      })

      await messageService.saveMessage({
        id: crypto.randomUUID(),
        conversationId: conv.id,
        ticketId: null,
        senderType: 'contact',
        senderId: 'contact-1',
        messageType: 'incoming',
        content: 'Iya betul, file saya 7MB. Solusinya bagaimana ya?',
        contentType: 'text',
        status: 'received',
        externalSourceId: null,
        contentAttributes: {},
        createdAt: new Date(Date.now() - 100000).toISOString(),
        updatedAt: new Date(Date.now() - 100000).toISOString(),
      })

      const summaryResult = await copilotService.summarizeConversation({
        conversationId: conv.id,
      })

      expect(summaryResult.summary).toBeDefined()
      expect(summaryResult.summary.length).toBeGreaterThan(15)
      expect(summaryResult.summary.toLowerCase()).toContain('invoice')
    })

    it('should inject summary directly into active ticket sticky internal note without adding chat bubbles', async () => {
      const { conversation: conv, ticket } = await conversationService.handleInboundMessage({
        inboxId: crypto.randomUUID(),
        sourceId: '+6281299990002',
        content: 'Paket langganan saya belum aktif setelah pembayaran lunas kemarin.',
      })

      const result = await copilotService.summarizeConversation({
        conversationId: conv.id,
        injectToStickyNote: true,
        updatedBy: 'agent-spv',
      })

      expect(result.injectedTicketId).toBe(ticket.id)
      expect(result.summary).toBeDefined()

      // Verifikasi sticky note tiket terisi
      const updatedTicket = await ticketService.getTicketById(ticket.id)
      expect(updatedTicket?.internalNote).toBe(result.summary)
      expect(updatedTicket?.internalNoteUpdatedBy).toBe('agent-spv')

      // Verifikasi pesan chat thread TIDAK tercemar oleh note
      const messages = await messageService.listConversationMessages(conv.id)
      expect(messages.some((m) => m.content?.includes(result.summary))).toBe(false)
      expect(messages.some((m) => m.content?.includes('Paket langganan'))).toBe(true)
    })
  })

  describe('2. Tone Adjustment Service', () => {
    const rawDraft = 'kamu harus bayar tagihan sekarang juga biar ga kena blokir'

    it('should adjust text to polite tone', async () => {
      const res = await copilotService.changeTone({
        text: rawDraft,
        tone: 'polite',
        language: 'id',
      })
      expect(res.adjustedText).toBeDefined()
      expect(res.tone).toBe('polite')
      // Harus menggunakan kata yang lebih sopan
      expect(res.adjustedText.toLowerCase()).toMatch(/mohon|silakan|terima kasih|bapak\/ibu/)
    })

    it('should adjust text to formal tone', async () => {
      const res = await copilotService.changeTone({
        text: 'halo gan mau tanya soal promo dong',
        tone: 'formal',
        language: 'id',
      })
      expect(res.tone).toBe('formal')
      expect(res.adjustedText.toLowerCase()).toMatch(/selamat|terkait|informasi|perihal/)
    })

    it('should adjust text to concise tone', async () => {
      const longText =
        'Jadi begini ya kak, mengenai kendala yang kakak sampaikan tadi perihal aplikasi yang tidak bisa dibuka, ' +
        'kami sarankan kakak coba lakukan clear cache dan coba restart aplikasi sekali lagi ya kak.'
      const res = await copilotService.changeTone({
        text: longText,
        tone: 'concise',
        language: 'id',
      })
      expect(res.tone).toBe('concise')
      expect(res.adjustedText.length).toBeLessThan(longText.length)
    })

    it('should adjust text to friendly tone', async () => {
      const res = await copilotService.changeTone({
        text: 'Kendala anda sedang diproses sistem.',
        tone: 'friendly',
        language: 'id',
      })
      expect(res.tone).toBe('friendly')
      expect(res.adjustedText.toLowerCase()).toMatch(/halo|kak|senang|bantu/)
    })
  })

  describe('3. Improve Writing Service', () => {
    it('should improve draft writing by fixing grammar and readability', async () => {
      const messyText = 'sy mw tny knp watsap sy gbs konek k server ya'
      const res = await copilotService.improveWriting({
        text: messyText,
        language: 'id',
      })
      expect(res.improvedText).toBeDefined()
      expect(res.improvedText.length).toBeGreaterThan(messyText.length)
      expect(res.improvedText.toLowerCase()).toContain('tanya')
      expect(res.improvedText.toLowerCase()).toContain('whatsapp')
    })
  })

  describe('4. RAG Suggestion Service (Draft Reply with Knowledge Base)', () => {
    it('should draft suggested reply citing relevant help center articles', async () => {
      // Siapkan artikel Help Center dan indeks di RAG
      const portal = await helpCenterService.createPortal({ name: 'Helpdesk', slug: 'hd' })
      const cat = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'WhatsApp',
        slug: 'wa',
      })
      const article = await helpCenterService.createArticle({
        categoryId: cat.id,
        title: 'Batas Ukuran File dan Media WhatsApp',
        slug: 'wa-file-limits',
        contentMarkdown:
          'WhatsApp Cloud API mendukung pengiriman dokumen PDF hingga 100MB, gambar hingga 5MB, ' +
          'dan video hingga 16MB. File yang melebihi batas tersebut akan ditolak oleh gateway Meta.',
        status: 'published',
      })

      await ragService.indexArticle(article.id)

      const draftResult = await copilotService.draftReplyWithRag({
        customerQuery: 'Berapa batas maksimal upload file PDF di WhatsApp?',
        tone: 'polite',
      })

      expect(draftResult.reply).toBeDefined()
      expect(draftResult.reply.toLowerCase()).toContain('100mb')
      expect(draftResult.suggestedArticles.length).toBeGreaterThan(0)
      expect(draftResult.suggestedArticles[0].title).toBe('Batas Ukuran File dan Media WhatsApp')
    })
  })

  describe('5. Unified Copilot Action Dispatcher', () => {
    it('should handle generic summarize action', async () => {
      const { conversation: conv } = await conversationService.handleInboundMessage({
        inboxId: crypto.randomUUID(),
        sourceId: '+6281299990003',
        content: 'Kapan pesanan saya sampai?',
      })

      const res = await copilotService.executeAction({
        action: 'summarize',
        conversationId: conv.id,
      })

      expect(res.action).toBe('summarize')
      expect(res.result).toBeDefined()
    })

    it('should handle change_tone action', async () => {
      const res = await copilotService.executeAction({
        action: 'change_tone',
        text: 'bayar sekarang ya',
        tone: 'polite',
      })
      expect(res.action).toBe('change_tone')
      expect(res.result).toBeDefined()
    })

    it('should handle draft_reply action', async () => {
      const res = await copilotService.executeAction({
        action: 'draft_reply',
        customerQuery: 'Bagaimana cara reset password?',
      })
      expect(res.action).toBe('draft_reply')
      expect(res.result).toBeDefined()
    })
  })

  describe('6. AI Settings Management (BYO Key Configuration)', () => {
    it('should save and retrieve AI provider settings', async () => {
      const created = await copilotService.updateAiSetting({
        provider: 'openai',
        apiKey: 'sk-proj-test1234567890',
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        active: true,
      })

      expect(created.provider).toBe('openai')
      expect(created.modelName).toBe('gpt-4o-mini')
      expect(created.active).toBe(true)

      const activeSetting = await copilotService.getAiSetting()
      expect(activeSetting).not.toBeNull()
      expect(activeSetting?.provider).toBe('openai')
      expect(activeSetting?.modelName).toBe('gpt-4o-mini')
    })
  })

  describe('7. Copilot HTTP API Endpoints (/api/v1/copilot)', () => {
    it('POST /api/v1/copilot/action should process copilot actions', async () => {
      const res = await app.request('/api/v1/copilot/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_tone',
          text: 'mohon segera kirim data',
          tone: 'friendly',
        }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.action).toBe('change_tone')
      expect(json.data.result).toBeDefined()
    })

    it('POST /api/v1/copilot/summarize should summarize conversation and optionally inject note', async () => {
      const { conversation: conv, ticket } = await conversationService.handleInboundMessage({
        inboxId: crypto.randomUUID(),
        sourceId: '+6281299990004',
        content: 'Transaksi nomor TRX-999 gagal terverifikasi.',
      })

      const res = await app.request('/api/v1/copilot/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conv.id,
          injectToStickyNote: true,
        }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.summary).toBeDefined()
      expect(json.data.injectedTicketId).toBe(ticket.id)
    })

    it('GET & PUT /api/v1/copilot/settings should manage AI settings via REST API', async () => {
      const putRes = await app.request('/api/v1/copilot/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'gemini',
          apiKey: 'AIzaSyTestKey123',
          modelName: 'gemini-1.5-flash',
          temperature: 0.5,
          active: true,
        }),
      })

      expect(putRes.status).toBe(200)
      const putJson = await putRes.json()
      expect(putJson.success).toBe(true)
      expect(putJson.data.provider).toBe('gemini')

      const getRes = await app.request('/api/v1/copilot/settings')
      expect(getRes.status).toBe(200)
      const getJson = await getRes.json()
      expect(getJson.success).toBe(true)
      expect(getJson.data.provider).toBe('gemini')
    })

    it('POST /api/v1/copilot/test-connection should verify AI provider connectivity', async () => {
      const res = await app.request('/api/v1/copilot/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          apiKey: 'sk-proj-test-key-12345',
          modelName: 'gpt-4o',
          prompt: 'Tes koneksi sistem Xatxoot.',
        }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.verified).toBe(true)
      expect(json.data.replyText).toContain('Koneksi berhasil')
      expect(json.data.latencyMs).toBeGreaterThan(0)
    })
  })

  describe('8. Single Organization Guardrail & Phase 5 Checklist', () => {
    it('should strictly NOT contain account_id or accountId in copilot requests or models', async () => {
      const setting = await copilotService.updateAiSetting({
        provider: 'ollama',
        modelName: 'llama3:8b',
        active: true,
      })

      expect((setting as Record<string, unknown>).account_id).toBeUndefined()
      expect((setting as Record<string, unknown>).accountId).toBeUndefined()
    })

    it('should have Task 5.10 marked as completed in docs/PHASE_5_CHECKLIST.md', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 5.10 (TDD - AI Copilot Services)**:')
    })
  })
})
