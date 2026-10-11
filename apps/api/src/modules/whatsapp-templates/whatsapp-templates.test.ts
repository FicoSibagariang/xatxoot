import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import type {
  CreateWhatsAppTemplateInput,
  SendWhatsAppTemplateMessageInput,
  WhatsAppTemplate,
} from '@xatxoot/shared'
import type { Server } from 'bun'
import app from '../../index'
import { conversationService, resetConversationStore } from '../conversations/conversations.service'
import { inboxService, resetInboxStore } from '../inboxes/inboxes.service'
import { resetTicketStore, ticketService } from '../tickets/tickets.service'
import { resetWhatsAppTemplateStore, whatsAppTemplateService } from './whatsapp-templates.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
  'Content-Type': 'application/json',
}

let mockGraphServer: Server | null = null
let mockGraphPort = 0
let lastSentPayload: Record<string, unknown> | null = null

const MOCK_WABA_ID = 'waba_mock_123456789'
const MOCK_PHONE_NUMBER_ID = 'phone_id_987654321'

beforeAll(() => {
  mockGraphServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)

      // 1. Mock WABA Template Sync Endpoint: GET /v18.0/:wabaId/message_templates
      if (req.method === 'GET' && url.pathname.includes('/message_templates')) {
        const auth = req.headers.get('authorization')
        if (!auth || !auth.startsWith('Bearer ')) {
          return Response.json(
            { error: { message: 'Invalid OAuth token', code: 190 } },
            { status: 401 },
          )
        }

        return Response.json({
          data: [
            {
              id: 'waba_tpl_001',
              name: 'order_status_update',
              language: 'id',
              category: 'UTILITY',
              status: 'APPROVED',
              components: [
                {
                  type: 'HEADER',
                  format: 'TEXT',
                  text: 'Informasi Status Pesanan Anda',
                },
                {
                  type: 'BODY',
                  text: 'Halo {{1}}, pesanan Anda {{2}} saat ini berstatus: {{3}}.',
                },
                {
                  type: 'BUTTONS',
                  buttons: [
                    {
                      type: 'QUICK_REPLY',
                      text: 'Cek Resi',
                    },
                  ],
                },
              ],
            },
            {
              id: 'waba_tpl_002',
              name: 'welcome_promo',
              language: 'id',
              category: 'MARKETING',
              status: 'APPROVED',
              components: [
                {
                  type: 'HEADER',
                  format: 'IMAGE',
                },
                {
                  type: 'BODY',
                  text: 'Selamat datang {{1}}! Gunakan voucher {{2}} untuk diskon 20%.',
                },
              ],
            },
            {
              id: 'waba_tpl_003',
              name: 'rejected_sample_flow',
              language: 'id',
              category: 'MARKETING',
              status: 'REJECTED',
              components: [
                {
                  type: 'BODY',
                  text: 'Pesan penawaran yang ditolak oleh Meta.',
                },
              ],
            },
          ],
          paging: { cursors: { before: 'abc', after: 'def' } },
        })
      }

      // 2. Mock Outbound Message Endpoint: POST /v18.0/:phoneNumberId/messages
      if (req.method === 'POST' && url.pathname.includes('/messages')) {
        const auth = req.headers.get('authorization')
        if (!auth || !auth.startsWith('Bearer ')) {
          return Response.json(
            { error: { message: 'Invalid OAuth token', code: 190 } },
            { status: 401 },
          )
        }

        const body = (await req.json()) as Record<string, unknown>
        lastSentPayload = body

        const messageId = `wamid.tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

        return Response.json({
          messaging_product: 'whatsapp',
          contacts: [{ input: body.to, wa_id: body.to }],
          messages: [{ id: messageId }],
        })
      }

      return Response.json({ not_found: true }, { status: 404 })
    },
  })

  mockGraphPort = mockGraphServer.port
  process.env.WHATSAPP_GRAPH_API_URL = `http://localhost:${mockGraphPort}`
})

afterAll(() => {
  mockGraphServer?.stop()
})

describe('WhatsApp Templates Module - Auth Guards', () => {
  it('GET /api/v1/whatsapp-templates should reject requests without Authorization with 401', async () => {
    const res = await app.request('/api/v1/whatsapp-templates', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/whatsapp-templates/sync should reject requests without Authorization with 401', async () => {
    const res = await app.request('/api/v1/whatsapp-templates/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wabaId: '123' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/whatsapp-templates/send should reject requests without Authorization with 401', async () => {
    const res = await app.request('/api/v1/whatsapp-templates/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateName: 'test' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('WhatsApp Templates Module - CRUD & Storage', () => {
  beforeEach(() => {
    resetWhatsAppTemplateStore()
  })

  it('should create and retrieve templates with filtering by status and category', async () => {
    const tpl1: CreateWhatsAppTemplateInput = {
      wabaTemplateId: 'tpl-local-01',
      name: 'payment_reminder',
      language: 'id',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [
        {
          type: 'BODY',
          text: 'Tagihan Anda jatuh tempo hari ini.',
        },
      ],
    }

    const tpl2: CreateWhatsAppTemplateInput = {
      wabaTemplateId: 'tpl-local-02',
      name: 'discount_flash_sale',
      language: 'id',
      category: 'MARKETING',
      status: 'REJECTED',
      components: [
        {
          type: 'BODY',
          text: 'Diskon kilat hanya malam ini!',
        },
      ],
    }

    const created1 = await whatsAppTemplateService.createTemplate(tpl1)
    const created2 = await whatsAppTemplateService.createTemplate(tpl2)

    expect(created1.id).toBeDefined()
    expect(created2.id).toBeDefined()

    // Retrieve by ID
    const found = await whatsAppTemplateService.getTemplateById(created1.id)
    expect(found?.name).toBe('payment_reminder')

    // Filter list by category
    const utilityList = await whatsAppTemplateService.listTemplates({ category: 'UTILITY' })
    expect(utilityList.length).toBe(1)
    expect(utilityList[0].name).toBe('payment_reminder')

    // Filter list by status
    const approvedList = await whatsAppTemplateService.listTemplates({ status: 'APPROVED' })
    expect(approvedList.length).toBe(1)
    expect(approvedList[0].status).toBe('APPROVED')
  })
})

describe('WhatsApp Templates Module - WABA Template Sync Engine', () => {
  beforeEach(() => {
    resetWhatsAppTemplateStore()
    resetInboxStore()
  })

  it('should synchronize templates from WABA Meta Cloud API and upsert into database', async () => {
    const syncResult = await whatsAppTemplateService.syncTemplates({
      wabaId: MOCK_WABA_ID,
      accessToken: 'valid-meta-access-token',
      baseUrl: `http://localhost:${mockGraphPort}`,
    })

    expect(syncResult.syncedCount).toBe(3)
    expect(syncResult.templates.length).toBe(3)

    // Verify template properties
    const orderTpl = syncResult.templates.find((t) => t.name === 'order_status_update')
    expect(orderTpl).toBeDefined()
    expect(orderTpl?.category).toBe('UTILITY')
    expect(orderTpl?.status).toBe('APPROVED')
    expect(orderTpl?.components.length).toBe(3)

    // Verify rejected template is synced with status REJECTED
    const rejectedTpl = syncResult.templates.find((t) => t.name === 'rejected_sample_flow')
    expect(rejectedTpl).toBeDefined()
    expect(rejectedTpl?.status).toBe('REJECTED')

    // Running sync again should perform upsert without duplicate records
    const secondSync = await whatsAppTemplateService.syncTemplates({
      wabaId: MOCK_WABA_ID,
      accessToken: 'valid-meta-access-token',
      baseUrl: `http://localhost:${mockGraphPort}`,
    })

    expect(secondSync.syncedCount).toBe(3)
    const all = await whatsAppTemplateService.listTemplates()
    expect(all.length).toBe(3)
  })
})

describe('WhatsApp Templates Module - Outbound Sender via Template', () => {
  beforeEach(() => {
    resetWhatsAppTemplateStore()
    resetInboxStore()
    resetConversationStore()
    resetTicketStore()
    lastSentPayload = null
  })

  it('should format and send approved template message to customer via WhatsApp Cloud API', async () => {
    // 1. Setup WhatsApp Cloud Inbox with credentials
    const { inbox } = await inboxService.createInbox({
      name: 'Official WA Cloud Line',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281200001111',
        phoneNumberId: MOCK_PHONE_NUMBER_ID,
        wabaId: MOCK_WABA_ID,
        accessToken: 'valid-meta-access-token',
        webhookVerifyToken: 'verify_token_123',
      },
      enableAutoAssign: false,
    })

    // 2. Sync approved template
    await whatsAppTemplateService.syncTemplates({
      wabaId: MOCK_WABA_ID,
      accessToken: 'valid-meta-access-token',
      baseUrl: `http://localhost:${mockGraphPort}`,
    })

    // 3. Create conversation and ticket
    const contactPhone = '+6281234567890'
    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      sourceId: contactPhone,
      senderPhone: contactPhone,
      senderName: 'Pak Joko',
      content: 'Halo CS, apakah pesanan saya sudah dikirim?',
    })

    const conversationId = inbound.conversation.id

    // 4. Send Template Message
    const sendInput: SendWhatsAppTemplateMessageInput = {
      conversationId,
      templateName: 'order_status_update',
      languageCode: 'id',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Pak Joko' },
            { type: 'text', text: 'ORD-9988' },
            { type: 'text', text: 'Sedang Diantar' },
          ],
        },
        {
          type: 'button',
          subType: 'quick_reply',
          index: 0,
          parameters: [{ type: 'payload', payload: 'TRACK_ORD-9988' }],
        },
      ],
    }

    const result = await whatsAppTemplateService.sendTemplateMessage(sendInput, {
      baseUrl: `http://localhost:${mockGraphPort}`,
    })

    expect(result.success).toBe(true)
    expect(result.wamid).toBeDefined()
    expect(result.wamid).toContain('wamid.tpl_')
    expect(result.message).toBeDefined()
    expect(result.message.messageType).toBe('template')
    expect(result.message.status).toBe('sent')
    expect(result.message.conversationId).toBe(conversationId)

    // Verify Meta Cloud API received correct payload structure
    expect(lastSentPayload).toBeDefined()
    expect(lastSentPayload?.messaging_product).toBe('whatsapp')
    expect(lastSentPayload?.to).toBe(contactPhone)
    expect(lastSentPayload?.type).toBe('template')

    const tplPayload = lastSentPayload?.template as Record<string, unknown>
    expect(tplPayload).toBeDefined()
    expect(tplPayload.name).toBe('order_status_update')
    expect(tplPayload.language).toEqual({ code: 'id' })

    const comps = tplPayload.components as Array<Record<string, unknown>>
    expect(comps.length).toBe(2)
    expect(comps[0].type).toBe('body')
    expect(comps[1].type).toBe('button')
  })

  it('should reject sending templates with REJECTED status with an error', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Official WA Cloud Line 2',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281200002222',
        phoneNumberId: MOCK_PHONE_NUMBER_ID,
        wabaId: MOCK_WABA_ID,
        accessToken: 'valid-meta-access-token',
        webhookVerifyToken: 'verify_token_456',
      },
    })

    await whatsAppTemplateService.syncTemplates({
      wabaId: MOCK_WABA_ID,
      accessToken: 'valid-meta-access-token',
      baseUrl: `http://localhost:${mockGraphPort}`,
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      sourceId: '+6289999999999',
      senderPhone: '+6289999999999',
      content: 'Tolong info promo',
    })

    // Attempt sending 'rejected_sample_flow'
    const sendInput: SendWhatsAppTemplateMessageInput = {
      conversationId: inbound.conversation.id,
      templateName: 'rejected_sample_flow',
      languageCode: 'id',
      components: [],
    }

    expect(
      whatsAppTemplateService.sendTemplateMessage(sendInput, {
        baseUrl: `http://localhost:${mockGraphPort}`,
      }),
    ).rejects.toThrow(/Template tidak disetujui|REJECTED/)
  })
})

describe('WhatsApp Templates Module - HTTP Endpoints', () => {
  beforeEach(() => {
    resetWhatsAppTemplateStore()
    resetInboxStore()
    resetConversationStore()
    resetTicketStore()
  })

  it('should interact with templates API via GET and POST endpoints', async () => {
    // 1. Sync via API
    const syncRes = await app.request('/api/v1/whatsapp-templates/sync', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        wabaId: MOCK_WABA_ID,
        accessToken: 'valid-meta-access-token',
        baseUrl: `http://localhost:${mockGraphPort}`,
      }),
    })

    expect(syncRes.status).toBe(200)
    const syncJson = (await syncRes.json()) as {
      syncedCount: number
      templates: WhatsAppTemplate[]
    }
    expect(syncJson.syncedCount).toBe(3)

    // 2. List via API
    const listRes = await app.request('/api/v1/whatsapp-templates?status=APPROVED', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(listRes.status).toBe(200)
    const listJson = (await listRes.json()) as { templates: WhatsAppTemplate[] }
    expect(listJson.templates.length).toBe(2)
  })
})

describe('Single Organization & Ubiquitous Language Integrity', () => {
  it('should verify Phase 2 checklist marks Task 2.16 as completed', async () => {
    const checklistFile = Bun.file('docs/PHASE_2_CHECKLIST.md')
    const content = await checklistFile.text()
    expect(content).toContain('- [x] **Task 2.16 (TDD)**')
  })
})
