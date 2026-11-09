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
import { config } from '../../config'
import { parseJsonField, sql, toIsoString } from '../../db'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { saveMessageToStore } from '../messages/message-store'
import { realtimeService } from '../realtime/realtime.service'

function mapTemplateRow(row: Record<string, unknown>): WhatsAppTemplate {
  return {
    id: String(row.id),
    wabaTemplateId: (row.wabaTemplateId as string | null) ?? null,
    name: String(row.name),
    language: String(row.language),
    category: row.category as WhatsAppTemplate['category'],
    status: row.status as WhatsAppTemplate['status'],
    components: parseJsonField<WhatsAppTemplate['components']>(row.components, []),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

export async function resetWhatsAppTemplateStore(): Promise<void> {
  await sql`DELETE FROM whatsapp_templates`
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
    const wabaTemplateId = parsed.wabaTemplateId ?? null
    const language = parsed.language || 'id'
    const status = parsed.status || 'APPROVED'
    const components = parsed.components || []

    const rows = await sql`
      INSERT INTO whatsapp_templates (
        id, waba_template_id, name, language, category, status, components, created_at, updated_at
      ) VALUES (
        ${id}, ${wabaTemplateId}, ${parsed.name}, ${language},
        ${parsed.category}, ${status}, ${JSON.stringify(components)},
        ${now}, ${now}
      )
      RETURNING
        id, waba_template_id AS "wabaTemplateId", name, language,
        category, status, components, created_at AS "createdAt", updated_at AS "updatedAt"
    `

    return mapTemplateRow(rows[0])
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<WhatsAppTemplate | null> {
    const rows = await sql`
      SELECT id, waba_template_id AS "wabaTemplateId", name, language,
             category, status, components, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM whatsapp_templates
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapTemplateRow(rows[0])
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
    const rows = await sql`
      SELECT id, waba_template_id AS "wabaTemplateId", name, language,
             category, status, components, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM whatsapp_templates
      WHERE name = ${name} AND language = ${language}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapTemplateRow(rows[0])
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
    return (rows || []).map(mapTemplateRow)
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

    const baseUrl = options.baseUrl || config.WHATSAPP_GRAPH_API_URL || 'https://graph.facebook.com'

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
      const existingRows = await sql`
        SELECT id, waba_template_id AS "wabaTemplateId", name, language,
               category, status, components, created_at AS "createdAt", updated_at AS "updatedAt"
        FROM whatsapp_templates
        WHERE waba_template_id = ${item.id} OR (name = ${item.name} AND language = ${item.language})
        LIMIT 1
      `

      const components = (item.components || []) as WhatsAppTemplate['components']

      if (existingRows && existingRows.length > 0) {
        const existing = mapTemplateRow(existingRows[0])
        const updatedRows = await sql`
          UPDATE whatsapp_templates
          SET status = ${item.status},
              category = ${item.category},
              components = ${JSON.stringify(components)},
              waba_template_id = ${item.id},
              updated_at = ${now}
          WHERE id = ${existing.id}
          RETURNING
            id, waba_template_id AS "wabaTemplateId", name, language,
            category, status, components, created_at AS "createdAt", updated_at AS "updatedAt"
        `
        syncedTemplates.push(mapTemplateRow(updatedRows[0]))
      } else {
        const id = crypto.randomUUID()
        const insertedRows = await sql`
          INSERT INTO whatsapp_templates (
            id, waba_template_id, name, language, category, status, components, created_at, updated_at
          ) VALUES (
            ${id}, ${item.id}, ${item.name}, ${item.language},
            ${item.category}, ${item.status}, ${JSON.stringify(components)},
            ${now}, ${now}
          )
          RETURNING
            id, waba_template_id AS "wabaTemplateId", name, language,
            category, status, components, created_at AS "createdAt", updated_at AS "updatedAt"
        `
        syncedTemplates.push(mapTemplateRow(insertedRows[0]))
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
      phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID || 'default_phone_id'
    }
    if (!accessToken) {
      accessToken = config.WHATSAPP_CLOUD_ACCESS_TOKEN || 'valid-meta-access-token'
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
      options?.baseUrl || config.WHATSAPP_GRAPH_API_URL || 'https://graph.facebook.com'

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
    const messageId = crypto.randomUUID()
    const content = `[WhatsApp Template: ${template.name}]`
    const contentAttributes = {
      templateName: template.name,
      templateLanguage: language,
      components: parsed.components || [],
    }

    await sql`
      INSERT INTO messages (
        id, conversation_id, ticket_id, sender_type, sender_id, message_type,
        content, content_type, status, external_source_id, content_attributes, created_at, updated_at
      ) VALUES (
        ${messageId}, ${parsed.conversationId}, ${convDetail.activeTicket?.id || null}, 'user',
        ${null}, 'template', ${content}, 'text',
        'sent', ${wamid}, ${JSON.stringify(contentAttributes)},
        ${now}, ${now}
      )
    `

    const message: Message = {
      id: messageId,
      conversationId: parsed.conversationId,
      ticketId: convDetail.activeTicket?.id || null,
      senderType: 'user',
      senderId: null,
      messageType: 'template',
      content,
      contentType: 'text',
      status: 'sent',
      externalSourceId: wamid,
      contentAttributes,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    }

    saveMessageToStore(message)

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
