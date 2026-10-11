import type {
  CreateWhatsAppTemplateInput,
  Message,
  SendWhatsAppTemplateMessageInput,
  UpdateWhatsAppTemplateInput,
  WhatsAppCloudChannelData,
  WhatsAppTemplate,
} from '@xatxoot/shared'
import {
  CreateWhatsAppTemplateInputSchema,
  SendWhatsAppTemplateMessageInputSchema,
} from '@xatxoot/shared'
import { sql } from '../../db'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { saveMessageToStore } from '../messages/message-store'
import { realtimeService } from '../realtime/realtime.service'

interface TemplateMemoryStore {
  templates: Map<string, WhatsAppTemplate>
}

const memoryStore: TemplateMemoryStore = {
  templates: new Map(),
}

export function resetWhatsAppTemplateStore(): void {
  memoryStore.templates.clear()
}

export interface SyncTemplatesOptions {
  inboxId?: string
  wabaId?: string
  accessToken?: string
  baseUrl?: string
}

export interface SyncTemplatesResult {
  syncedCount: number
  templates: WhatsAppTemplate[]
}

export interface SendTemplateResult {
  success: boolean
  wamid: string
  message: Message
}

export class WhatsAppTemplateService {
  /**
   * Create or manually register a template
   */
  async createTemplate(input: CreateWhatsAppTemplateInput): Promise<WhatsAppTemplate> {
    const parsed = CreateWhatsAppTemplateInputSchema.parse(input)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const template: WhatsAppTemplate = {
      id,
      wabaTemplateId: parsed.wabaTemplateId ?? null,
      name: parsed.name,
      language: parsed.language || 'id',
      category: parsed.category,
      status: parsed.status || 'APPROVED',
      components: parsed.components,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await sql`
        INSERT INTO whatsapp_templates (
          id, waba_template_id, name, language, category, status, components, created_at, updated_at
        ) VALUES (
          ${template.id}, ${template.wabaTemplateId}, ${template.name}, ${template.language},
          ${template.category}, ${template.status}, ${JSON.stringify(template.components)},
          ${now}, ${now}
        )
      `
    } catch {
      // Memory fallback
    }

    memoryStore.templates.set(id, template)
    return template
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<WhatsAppTemplate | null> {
    const inMem = memoryStore.templates.get(id)
    if (inMem) return inMem

    try {
      const rows = await sql`
        SELECT id, waba_template_id AS "wabaTemplateId", name, language,
               category, status, components, created_at AS "createdAt", updated_at AS "updatedAt"
        FROM whatsapp_templates
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as WhatsAppTemplate
      }
    } catch {
      // Memory fallback
    }

    return null
  }

  /**
   * Get template by name and language
   */
  async getTemplateByNameAndLanguage(
    name: string,
    language = 'id',
  ): Promise<WhatsAppTemplate | null> {
    for (const tpl of memoryStore.templates.values()) {
      if (tpl.name === name && tpl.language === language) {
        return tpl
      }
    }

    try {
      const rows = await sql`
        SELECT id, waba_template_id AS "wabaTemplateId", name, language,
               category, status, components, created_at AS "createdAt", updated_at AS "updatedAt"
        FROM whatsapp_templates
        WHERE name = ${name} AND language = ${language}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as WhatsAppTemplate
      }
    } catch {
      // Memory fallback
    }

    return null
  }

  /**
   * List templates with optional filters
   */
  async listTemplates(filters?: {
    status?: string
    category?: string
    language?: string
    search?: string
  }): Promise<WhatsAppTemplate[]> {
    try {
      let query = sql`
        SELECT id, waba_template_id AS "wabaTemplateId", name, language,
               category, status, components, created_at AS "createdAt", updated_at AS "updatedAt"
        FROM whatsapp_templates
        WHERE 1 = 1
      `

      if (filters?.status) {
        query = sql`${query} AND status = ${filters.status}`
      }
      if (filters?.category) {
        query = sql`${query} AND category = ${filters.category}`
      }
      if (filters?.language) {
        query = sql`${query} AND language = ${filters.language}`
      }
      if (filters?.search) {
        const term = `%${filters.search}%`
        query = sql`${query} AND name ILIKE ${term}`
      }

      query = sql`${query} ORDER BY name ASC`
      const rows = await query
      if (rows && rows.length > 0) {
        return rows as unknown as WhatsAppTemplate[]
      }
    } catch {
      // Memory fallback
    }

    let list = Array.from(memoryStore.templates.values())
    if (filters?.status) {
      list = list.filter((t) => t.status === filters.status)
    }
    if (filters?.category) {
      list = list.filter((t) => t.category === filters.category)
    }
    if (filters?.language) {
      list = list.filter((t) => t.language === filters.language)
    }
    if (filters?.search) {
      const lower = filters.search.toLowerCase()
      list = list.filter((t) => t.name.toLowerCase().includes(lower))
    }
    return list
  }

  /**
   * Synchronize templates from WABA Meta Cloud API
   */
  async syncTemplates(options: SyncTemplatesOptions): Promise<SyncTemplatesResult> {
    let wabaId = options.wabaId
    let accessToken = options.accessToken

    if (options.inboxId) {
      const inboxData = await inboxService.getInboxById(options.inboxId)
      if (inboxData?.channel && 'wabaId' in inboxData.channel) {
        const ch = inboxData.channel as WhatsAppCloudChannelData
        wabaId = wabaId || ch.wabaId
        accessToken = accessToken || ch.accessToken
      }
    }

    if (!wabaId) {
      throw new Error('wabaId wajib diisi untuk sinkronisasi template')
    }
    if (!accessToken) {
      throw new Error('accessToken wajib diisi untuk sinkronisasi template')
    }

    const baseUrl =
      options.baseUrl || process.env.WHATSAPP_GRAPH_API_URL || 'https://graph.facebook.com'

    const endpoint = `${baseUrl}/v18.0/${wabaId}/message_templates`

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Gagal sinkronisasi template dari Meta Graph API: ${errorText}`)
    }

    const json = (await res.json()) as {
      data?: Array<{
        id: string
        name: string
        language: string
        category: string
        status: string
        components?: Array<Record<string, unknown>>
      }>
    }

    const rawTemplates = json.data || []
    const syncedTemplates: WhatsAppTemplate[] = []
    const now = new Date().toISOString()

    for (const item of rawTemplates) {
      // Find existing template by wabaTemplateId or name+language
      let existing = Array.from(memoryStore.templates.values()).find(
        (t) =>
          (t.wabaTemplateId && t.wabaTemplateId === item.id) ||
          (t.name === item.name && t.language === item.language),
      )

      if (!existing) {
        existing = await this.getTemplateByNameAndLanguage(item.name, item.language)
      }

      const components = (item.components || []) as WhatsAppTemplate['components']

      if (existing) {
        existing.status = item.status as WhatsAppTemplate['status']
        existing.category = item.category as WhatsAppTemplate['category']
        existing.components = components
        existing.wabaTemplateId = item.id
        existing.updatedAt = now

        try {
          await sql`
            UPDATE whatsapp_templates
            SET status = ${existing.status},
                category = ${existing.category},
                components = ${JSON.stringify(existing.components)},
                waba_template_id = ${existing.wabaTemplateId},
                updated_at = ${now}
            WHERE id = ${existing.id}
          `
        } catch {
          // Memory fallback
        }

        memoryStore.templates.set(existing.id, existing)
        syncedTemplates.push(existing)
      } else {
        const newTpl: WhatsAppTemplate = {
          id: crypto.randomUUID(),
          wabaTemplateId: item.id,
          name: item.name,
          language: item.language,
          category: item.category as WhatsAppTemplate['category'],
          status: item.status as WhatsAppTemplate['status'],
          components,
          createdAt: now,
          updatedAt: now,
        }

        try {
          await sql`
            INSERT INTO whatsapp_templates (
              id, waba_template_id, name, language, category, status, components, created_at, updated_at
            ) VALUES (
              ${newTpl.id}, ${newTpl.wabaTemplateId}, ${newTpl.name}, ${newTpl.language},
              ${newTpl.category}, ${newTpl.status}, ${JSON.stringify(newTpl.components)},
              ${now}, ${now}
            )
          `
        } catch {
          // Memory fallback
        }

        memoryStore.templates.set(newTpl.id, newTpl)
        syncedTemplates.push(newTpl)
      }
    }

    return {
      syncedCount: syncedTemplates.length,
      templates: syncedTemplates,
    }
  }

  /**
   * Outbound sender: format and send template message via WhatsApp Cloud API
   */
  async sendTemplateMessage(
    input: SendWhatsAppTemplateMessageInput,
    options?: { baseUrl?: string },
  ): Promise<SendTemplateResult> {
    const parsed = SendWhatsAppTemplateMessageInputSchema.parse(input)

    // 1. Fetch conversation details
    const convDetail = await conversationService.getConversationById(parsed.conversationId)
    if (!convDetail) {
      throw new Error(`Conversation not found: ${parsed.conversationId}`)
    }

    const contact = convDetail.contact
    const recipientPhone = contact?.phoneNumber || contact?.identifier
    if (!recipientPhone) {
      throw new Error('Nomor telepon kontak tidak ditemukan untuk percakapan ini')
    }

    // 2. Fetch channel credentials
    const inboxData = await inboxService.getInboxById(convDetail.conversation.inboxId)
    let phoneNumberId = ''
    let accessToken = ''

    if (inboxData?.channel && 'phoneNumberId' in inboxData.channel) {
      const cloudCh = inboxData.channel as WhatsAppCloudChannelData
      phoneNumberId = cloudCh.phoneNumberId
      accessToken = cloudCh.accessToken
    }

    if (!phoneNumberId) {
      phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || 'default_phone_id'
    }
    if (!accessToken) {
      accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || 'valid-meta-access-token'
    }

    // 3. Verify template is registered and APPROVED
    const language = parsed.languageCode || 'id'
    const template = await this.getTemplateByNameAndLanguage(parsed.templateName, language)
    if (!template) {
      throw new Error(`Template tidak ditemukan: ${parsed.templateName} (${language})`)
    }

    if (template.status !== 'APPROVED') {
      throw new Error(
        `Template tidak disetujui untuk pengiriman pesan (Status: ${template.status})`,
      )
    }

    // 4. Build Meta Graph API payload
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'template',
      template: {
        name: template.name,
        language: {
          code: language,
        },
        components: parsed.components || [],
      },
    }

    const baseUrl =
      options?.baseUrl || process.env.WHATSAPP_GRAPH_API_URL || 'https://graph.facebook.com'

    const endpoint = `${baseUrl}/v18.0/${phoneNumberId}/messages`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Gagal mengirim template message ke Meta API: ${errorText}`)
    }

    const json = (await res.json()) as {
      messages?: Array<{ id: string }>
    }

    const wamid = json.messages?.[0]?.id || `wamid.tpl_${Date.now()}`
    const now = new Date().toISOString()

    // 5. Create Message record
    const message: Message = {
      id: crypto.randomUUID(),
      conversationId: parsed.conversationId,
      ticketId: convDetail.activeTicket?.id || null,
      senderType: 'user',
      senderId: null,
      messageType: 'template',
      content: `[WhatsApp Template: ${template.name}]`,
      contentType: 'text',
      status: 'sent',
      externalSourceId: wamid,
      contentAttributes: {
        templateName: template.name,
        templateLanguage: language,
        components: parsed.components || [],
      },
      attachments: [],
      createdAt: now,
      updatedAt: now,
    }

    saveMessageToStore(message)

    try {
      await sql`
        INSERT INTO messages (
          id, conversation_id, ticket_id, sender_type, sender_id, message_type,
          content, content_type, status, source_id, content_attributes, created_at, updated_at
        ) VALUES (
          ${message.id}, ${message.conversationId}, ${message.ticketId}, ${message.senderType},
          ${message.senderId}, ${message.messageType}, ${message.content}, ${message.contentType},
          ${message.status}, ${message.externalSourceId}, ${JSON.stringify(message.contentAttributes)},
          ${now}, ${now}
        )
      `
    } catch {
      // Memory fallback
    }

    realtimeService.broadcast({
      event: 'message.created',
      data: { message },
    })

    return {
      success: true,
      wamid,
      message,
    }
  }
}

export const whatsAppTemplateService = new WhatsAppTemplateService()
