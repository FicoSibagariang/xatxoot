import {
  ChannelTypeSchema,
  type CreateInboxInput,
  type CreateWhatsAppCloudChannelInput,
  type CreateWhatsAppUnofficialChannelInput,
  type Inbox,
  SenderNameTypeSchema,
} from '@xatxoot/shared'
import { sql } from '../../db'

export type {
  CreateInboxInput,
  CreateWhatsAppCloudChannelInput,
  CreateWhatsAppUnofficialChannelInput,
}

export interface WhatsAppCloudChannelData {
  id: string
  phoneNumber: string
  phoneNumberId: string
  wabaId: string
  accessToken: string
  webhookVerifyToken: string
  createdAt?: string
  updatedAt?: string
}

export interface WhatsAppUnofficialChannelData {
  id: string
  sessionId: string
  phoneNumber?: string | null
  connectionStatus: string
  qrCode?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface WebWidgetChannelData {
  id: string
  websiteToken: string
  websiteUrl?: string | null
  allowedDomains: string[]
  widgetColor: string
  replyTime: string
  preChatFormEnabled: boolean
  hmacSecret?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ApiChannelData {
  id: string
  name: string
  webhookUrl?: string | null
  apiKeyHash?: string
  authToken?: string | null
  createdAt?: string
  updatedAt?: string
}

export type ChannelData =
  | WhatsAppCloudChannelData
  | WhatsAppUnofficialChannelData
  | WebWidgetChannelData
  | ApiChannelData

export interface InboxMemberRecord {
  id: string
  inboxId: string
  userId: string
  createdAt: string
}

export interface CreateInboxDto {
  name: string
  channelType: string
  channelId?: string
  channel?: {
    phoneNumber?: string
    phoneNumberId?: string
    wabaId?: string
    accessToken?: string
    webhookVerifyToken?: string
    sessionId?: string
    websiteToken?: string
    websiteUrl?: string | null
    allowedDomains?: string[]
    widgetColor?: string
    replyTime?: 'in_a_few_minutes' | 'in_a_few_hours' | 'in_a_day'
    preChatFormEnabled?: boolean
    webhookUrl?: string | null
  }
  enableAutoAssign?: boolean
  greetingEnabled?: boolean
  greetingMessage?: string | null
  workingHoursEnabled?: boolean
  workingHours?: Record<string, unknown>
  outOfOfficeMessage?: string | null
  lockToSingleConv?: boolean
  senderNameType?: 'friendly' | 'professional'
}

// In-memory fallback store for offline/testing mode
const memoryStore = {
  inboxes: new Map<string, Inbox>(),
  channels: new Map<string, { type: string; data: ChannelData }>(),
  members: new Map<string, InboxMemberRecord[]>(), // inboxId -> members
}

export function resetInboxStore(): void {
  memoryStore.inboxes.clear()
  memoryStore.channels.clear()
  memoryStore.members.clear()
}

export class InboxService {
  async createInbox(dto: CreateInboxDto): Promise<{ inbox: Inbox; channel: ChannelData }> {
    const channelTypeParse = ChannelTypeSchema.safeParse(dto.channelType)
    if (!channelTypeParse.success) {
      throw new Error(`Tipe saluran tidak valid: ${dto.channelType}`)
    }
    const channelType = channelTypeParse.data

    if (!dto.name || dto.name.trim().length === 0) {
      throw new Error('Nama inbox wajib diisi')
    }

    const inboxId = crypto.randomUUID()
    const channelId = dto.channelId || crypto.randomUUID()
    const now = new Date().toISOString()

    let channelRecord: ChannelData

    if (channelType === 'whatsapp_cloud') {
      const channelInput = dto.channel
      if (
        !channelInput?.phoneNumber ||
        !channelInput?.phoneNumberId ||
        !channelInput?.wabaId ||
        !channelInput?.accessToken ||
        !channelInput?.webhookVerifyToken
      ) {
        throw new Error('Kredensial WhatsApp Cloud tidak lengkap')
      }

      channelRecord = {
        id: channelId,
        phoneNumber: channelInput.phoneNumber,
        phoneNumberId: channelInput.phoneNumberId,
        wabaId: channelInput.wabaId,
        accessToken: channelInput.accessToken,
        webhookVerifyToken: channelInput.webhookVerifyToken,
        createdAt: now,
        updatedAt: now,
      }

      try {
        await sql`
          INSERT INTO channels_whatsapp_cloud (
            id, phone_number, phone_number_id, waba_id, access_token, webhook_verify_token, created_at, updated_at
          ) VALUES (
            ${channelId}, ${channelRecord.phoneNumber}, ${channelRecord.phoneNumberId},
            ${channelRecord.wabaId}, ${channelRecord.accessToken}, ${channelRecord.webhookVerifyToken},
            ${now}, ${now}
          )
        `
      } catch {
        // Fallback to memoryStore
      }
    } else if (channelType === 'whatsapp_unofficial') {
      const channelInput = dto.channel
      const sessionId = channelInput?.sessionId || `wa_${crypto.randomUUID()}`

      channelRecord = {
        id: channelId,
        sessionId,
        phoneNumber: channelInput?.phoneNumber || null,
        connectionStatus: 'disconnected',
        qrCode: null,
        createdAt: now,
        updatedAt: now,
      }

      try {
        await sql`
          INSERT INTO channels_whatsapp_unofficial (
            id, session_id, phone_number, connection_status, qr_code, created_at, updated_at
          ) VALUES (
            ${channelId}, ${channelRecord.sessionId}, ${channelRecord.phoneNumber},
            'disconnected', NULL, ${now}, ${now}
          )
        `
      } catch {
        // Fallback to memoryStore
      }
    } else if (channelType === 'web_widget') {
      const channelInput = dto.channel
      const websiteToken = channelInput?.websiteToken || `token_${crypto.randomUUID()}`

      channelRecord = {
        id: channelId,
        websiteToken,
        websiteUrl: channelInput?.websiteUrl || null,
        allowedDomains: channelInput?.allowedDomains || [],
        widgetColor: channelInput?.widgetColor || '#10b981',
        replyTime: channelInput?.replyTime || 'in_a_few_minutes',
        preChatFormEnabled: channelInput?.preChatFormEnabled || false,
        createdAt: now,
        updatedAt: now,
      }

      try {
        await sql`
          INSERT INTO channels_web_widget (
            id, website_token, website_url, allowed_domains, widget_color, reply_time, pre_chat_form_enabled, created_at, updated_at
          ) VALUES (
            ${channelId}, ${channelRecord.websiteToken}, ${channelRecord.websiteUrl},
            ${channelRecord.allowedDomains}, ${channelRecord.widgetColor}, ${channelRecord.replyTime},
            ${channelRecord.preChatFormEnabled}, ${now}, ${now}
          )
        `
      } catch {
        // Fallback to memoryStore
      }
    } else {
      // api channel
      const channelInput = dto.channel
      channelRecord = {
        id: channelId,
        name: dto.name,
        webhookUrl: channelInput?.webhookUrl || null,
        apiKeyHash: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      }

      try {
        await sql`
          INSERT INTO channels_api (
            id, name, webhook_url, api_key_hash, created_at, updated_at
          ) VALUES (
            ${channelId}, ${channelRecord.name}, ${channelRecord.webhookUrl}, ${channelRecord.apiKeyHash}, ${now}, ${now}
          )
        `
      } catch {
        // Fallback to memoryStore
      }
    }

    const inboxRecord: Inbox = {
      id: inboxId,
      name: dto.name,
      channelType,
      channelId,
      enableAutoAssign: dto.enableAutoAssign ?? true,
      greetingEnabled: dto.greetingEnabled ?? false,
      greetingMessage: dto.greetingMessage ?? null,
      workingHoursEnabled: dto.workingHoursEnabled ?? false,
      workingHours: dto.workingHours ?? {},
      outOfOfficeMessage: dto.outOfOfficeMessage ?? null,
      lockToSingleConv: dto.lockToSingleConv ?? false,
      senderNameType: dto.senderNameType ?? 'friendly',
      createdAt: now,
      updatedAt: now,
    }

    try {
      await sql`
        INSERT INTO inboxes (
          id, name, channel_type, channel_id, enable_auto_assign, greeting_enabled,
          greeting_message, working_hours_enabled, working_hours, out_of_office_message,
          lock_to_single_conv, sender_name_type, created_at, updated_at
        ) VALUES (
          ${inboxId}, ${inboxRecord.name}, ${inboxRecord.channelType}, ${channelId},
          ${inboxRecord.enableAutoAssign}, ${inboxRecord.greetingEnabled}, ${inboxRecord.greetingMessage},
          ${inboxRecord.workingHoursEnabled}, ${JSON.stringify(inboxRecord.workingHours)},
          ${inboxRecord.outOfOfficeMessage}, ${inboxRecord.lockToSingleConv},
          ${inboxRecord.senderNameType}, ${now}, ${now}
        )
      `
    } catch {
      // Fallback to memoryStore
    }

    memoryStore.inboxes.set(inboxId, inboxRecord)
    memoryStore.channels.set(channelId, { type: channelType, data: channelRecord })
    memoryStore.members.set(inboxId, [])

    return { inbox: inboxRecord, channel: channelRecord }
  }

  async getInboxById(id: string): Promise<{ inbox: Inbox; channel: ChannelData } | null> {
    if (id === 'active' || id === 'default') {
      try {
        const rows = await sql`
          SELECT id FROM inboxes WHERE channel_type = 'whatsapp_unofficial' ORDER BY created_at DESC LIMIT 1
        `
        if (rows.length > 0) {
          return this.getInboxById(rows[0].id)
        }
      } catch {
        // Fallback
      }
      for (const [inboxId, inboxRec] of memoryStore.inboxes.entries()) {
        if (inboxRec.channelType === 'whatsapp_unofficial') {
          return this.getInboxById(inboxId)
        }
      }
    }

    try {
      const rows = await sql`
        SELECT id, name, channel_type as "channelType", channel_id as "channelId",
               enable_auto_assign as "enableAutoAssign", greeting_enabled as "greetingEnabled",
               greeting_message as "greetingMessage", working_hours_enabled as "workingHoursEnabled",
               working_hours as "workingHours", out_of_office_message as "outOfOfficeMessage",
               lock_to_single_conv as "lockToSingleConv", sender_name_type as "senderNameType",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM inboxes
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows.length > 0) {
        const inbox = rows[0] as Inbox
        const channel =
          (await this.getChannelById(inbox.channelType, inbox.channelId)) ||
          memoryStore.channels.get(inbox.channelId)?.data ||
          ({} as ChannelData)
        return { inbox, channel }
      }
    } catch {
      // DB offline, fallback to memoryStore
    }

    const inbox = memoryStore.inboxes.get(id)
    if (!inbox) return null
    const channelEntry = memoryStore.channels.get(inbox.channelId)
    return { inbox, channel: channelEntry ? channelEntry.data : ({} as ChannelData) }
  }

  async getChannelById(channelType: string, channelId: string): Promise<ChannelData | null> {
    try {
      if (channelType === 'whatsapp_cloud') {
        const rows = await sql`
          SELECT id, phone_number as "phoneNumber", phone_number_id as "phoneNumberId",
                 waba_id as "wabaId", access_token as "accessToken",
                 webhook_verify_token as "webhookVerifyToken", created_at as "createdAt",
                 updated_at as "updatedAt"
          FROM channels_whatsapp_cloud
          WHERE id = ${channelId}
          LIMIT 1
        `
        if (rows.length > 0) return rows[0] as WhatsAppCloudChannelData
      } else if (channelType === 'whatsapp_unofficial') {
        const rows = await sql`
          SELECT id, session_id as "sessionId", phone_number as "phoneNumber",
                 connection_status as "connectionStatus", qr_code as "qrCode",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM channels_whatsapp_unofficial
          WHERE id = ${channelId}
          LIMIT 1
        `
        if (rows.length > 0) return rows[0] as WhatsAppUnofficialChannelData
      } else if (channelType === 'web_widget') {
        const rows = await sql`
          SELECT id, website_token as "websiteToken", website_url as "websiteUrl",
                 allowed_domains as "allowedDomains", widget_color as "widgetColor",
                 reply_time as "replyTime", pre_chat_form_enabled as "preChatFormEnabled",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM channels_web_widget
          WHERE id = ${channelId}
          LIMIT 1
        `
        if (rows.length > 0) return rows[0] as WebWidgetChannelData
      } else if (channelType === 'api') {
        const rows = await sql`
          SELECT id, name, webhook_url as "webhookUrl", api_key_hash as "apiKeyHash",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM channels_api
          WHERE id = ${channelId}
          LIMIT 1
        `
        if (rows.length > 0) return rows[0] as ApiChannelData
      }
    } catch {
      // Fallback
    }

    const memoryEntry = memoryStore.channels.get(channelId)
    return memoryEntry ? memoryEntry.data : null
  }

  async listInboxes(): Promise<Inbox[]> {
    try {
      const rows = await sql`
        SELECT id, name, channel_type as "channelType", channel_id as "channelId",
               enable_auto_assign as "enableAutoAssign", greeting_enabled as "greetingEnabled",
               greeting_message as "greetingMessage", working_hours_enabled as "workingHoursEnabled",
               working_hours as "workingHours", out_of_office_message as "outOfOfficeMessage",
               lock_to_single_conv as "lockToSingleConv", sender_name_type as "senderNameType",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM inboxes
        ORDER BY created_at DESC
      `
      if (rows.length > 0) {
        return rows as Inbox[]
      }
    } catch {
      // Fallback to memoryStore
    }

    return Array.from(memoryStore.inboxes.values())
  }

  async updateInbox(id: string, updates: Partial<CreateInboxDto>): Promise<Inbox | null> {
    if (updates.senderNameType !== undefined) {
      const parseSender = SenderNameTypeSchema.safeParse(updates.senderNameType)
      if (!parseSender.success) {
        throw new Error('Tipe nama pengirim tidak valid')
      }
    }

    const existing = await this.getInboxById(id)
    if (!existing) return null

    const now = new Date().toISOString()
    const updated: Inbox = {
      ...existing.inbox,
      name: updates.name !== undefined ? updates.name : existing.inbox.name,
      enableAutoAssign:
        updates.enableAutoAssign !== undefined
          ? updates.enableAutoAssign
          : existing.inbox.enableAutoAssign,
      greetingEnabled:
        updates.greetingEnabled !== undefined
          ? updates.greetingEnabled
          : existing.inbox.greetingEnabled,
      greetingMessage:
        updates.greetingMessage !== undefined
          ? updates.greetingMessage
          : existing.inbox.greetingMessage,
      workingHoursEnabled:
        updates.workingHoursEnabled !== undefined
          ? updates.workingHoursEnabled
          : existing.inbox.workingHoursEnabled,
      workingHours:
        updates.workingHours !== undefined ? updates.workingHours : existing.inbox.workingHours,
      outOfOfficeMessage:
        updates.outOfOfficeMessage !== undefined
          ? updates.outOfOfficeMessage
          : existing.inbox.outOfOfficeMessage,
      lockToSingleConv:
        updates.lockToSingleConv !== undefined
          ? updates.lockToSingleConv
          : existing.inbox.lockToSingleConv,
      senderNameType:
        updates.senderNameType !== undefined
          ? updates.senderNameType
          : existing.inbox.senderNameType,
      updatedAt: now,
    }

    try {
      await sql`
        UPDATE inboxes
        SET name = ${updated.name},
            enable_auto_assign = ${updated.enableAutoAssign},
            greeting_enabled = ${updated.greetingEnabled},
            greeting_message = ${updated.greetingMessage},
            working_hours_enabled = ${updated.workingHoursEnabled},
            working_hours = ${JSON.stringify(updated.workingHours)},
            out_of_office_message = ${updated.outOfOfficeMessage},
            lock_to_single_conv = ${updated.lockToSingleConv},
            sender_name_type = ${updated.senderNameType},
            updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Fallback
    }

    if (updates.channel && existing.inbox.channelType === 'web_widget') {
      const channelData = existing.channel as WebWidgetChannelData
      const updatedChannel: WebWidgetChannelData = {
        ...channelData,
        widgetColor: updates.channel.widgetColor || channelData.widgetColor,
        websiteUrl:
          updates.channel.websiteUrl !== undefined
            ? updates.channel.websiteUrl
            : channelData.websiteUrl,
        allowedDomains: updates.channel.allowedDomains || channelData.allowedDomains,
        replyTime: updates.channel.replyTime || channelData.replyTime,
        preChatFormEnabled:
          updates.channel.preChatFormEnabled !== undefined
            ? updates.channel.preChatFormEnabled
            : channelData.preChatFormEnabled,
        updatedAt: now,
      }

      try {
        await sql`
          UPDATE channels_web_widget
          SET widget_color = ${updatedChannel.widgetColor},
              website_url = ${updatedChannel.websiteUrl},
              allowed_domains = ${updatedChannel.allowedDomains},
              reply_time = ${updatedChannel.replyTime},
              pre_chat_form_enabled = ${updatedChannel.preChatFormEnabled},
              updated_at = ${now}
          WHERE id = ${existing.inbox.channelId}
        `
      } catch {
        // Fallback
      }

      memoryStore.channels.set(existing.inbox.channelId, {
        type: 'web_widget',
        data: updatedChannel,
      })
    }

    memoryStore.inboxes.set(id, updated)
    return updated
  }

  async deleteInbox(id: string): Promise<boolean> {
    const existing = await this.getInboxById(id)
    if (!existing) return false

    try {
      await sql`DELETE FROM inboxes WHERE id = ${id}`
      if (existing.inbox.channelType === 'whatsapp_cloud') {
        await sql`DELETE FROM channels_whatsapp_cloud WHERE id = ${existing.inbox.channelId}`
      } else if (existing.inbox.channelType === 'whatsapp_unofficial') {
        await sql`DELETE FROM channels_whatsapp_unofficial WHERE id = ${existing.inbox.channelId}`
      } else if (existing.inbox.channelType === 'web_widget') {
        await sql`DELETE FROM channels_web_widget WHERE id = ${existing.inbox.channelId}`
      } else if (existing.inbox.channelType === 'api') {
        await sql`DELETE FROM channels_api WHERE id = ${existing.inbox.channelId}`
      }
    } catch {
      // Fallback
    }

    memoryStore.inboxes.delete(id)
    memoryStore.channels.delete(existing.inbox.channelId)
    memoryStore.members.delete(id)
    return true
  }

  async getChannelDetails(inboxId: string): Promise<Record<string, unknown> | null> {
    const inboxResult = await this.getInboxById(inboxId)
    if (!inboxResult) return null

    const { inbox, channel } = inboxResult
    if (inbox.channelType === 'whatsapp_cloud') {
      const waCloud = channel as WhatsAppCloudChannelData
      return {
        channelType: 'whatsapp_cloud',
        id: waCloud.id,
        phoneNumber: waCloud.phoneNumber,
        phoneNumberId: waCloud.phoneNumberId,
        wabaId: waCloud.wabaId,
        webhookVerifyToken: waCloud.webhookVerifyToken,
        webhookCallbackUrl: `/api/v1/webhooks/whatsapp-cloud/${waCloud.phoneNumberId}`,
      }
    }

    if (inbox.channelType === 'whatsapp_unofficial') {
      const waUnofficial = channel as WhatsAppUnofficialChannelData
      return {
        channelType: 'whatsapp_unofficial',
        id: waUnofficial.id,
        sessionId: waUnofficial.sessionId,
        phoneNumber: waUnofficial.phoneNumber,
        connectionStatus: waUnofficial.connectionStatus,
        qrCode: waUnofficial.qrCode,
      }
    }

    return {
      channelType: inbox.channelType,
      ...channel,
    }
  }

  async getQrCode(inboxId: string): Promise<Record<string, unknown> | null> {
    const channelDetails = await this.getChannelDetails(inboxId)
    if (!channelDetails || channelDetails.channelType !== 'whatsapp_unofficial') {
      return null
    }

    const sessionId = String(channelDetails.sessionId)
    const channelId = String(channelDetails.id)
    const gatewayPort = Number(process.env.PORT_GATEWAY || 8801)
    const gatewayUrl = `http://127.0.0.1:${gatewayPort}`

    try {
      // 1. Query gateway session status
      const statusRes = await fetch(`${gatewayUrl}/api/sessions/${sessionId}/status`, {
        signal: AbortSignal.timeout(1500),
      })

      if (statusRes.ok) {
        const gwStatus = (await statusRes.json()) as {
          status: string
          qrCode?: string | null
          phoneNumber?: string | null
        }

        if (gwStatus.status === 'connected') {
          if (channelDetails.connectionStatus !== 'connected') {
            await sql`
              UPDATE channels_whatsapp_unofficial
              SET connection_status = 'connected', phone_number = ${gwStatus.phoneNumber || null}, qr_code = NULL, updated_at = NOW()
              WHERE id = ${channelId}
            `.catch(() => {})
          }
          return {
            sessionId,
            connectionStatus: 'connected',
            phoneNumber: gwStatus.phoneNumber || null,
            qrCode: null,
          }
        }

        if (gwStatus.qrCode) {
          await sql`
            UPDATE channels_whatsapp_unofficial
            SET connection_status = 'qr_ready', qr_code = ${gwStatus.qrCode}, updated_at = NOW()
            WHERE id = ${channelId}
          `.catch(() => {})
          return {
            sessionId,
            connectionStatus: 'qr_ready',
            qrCode: gwStatus.qrCode,
            phoneNumber: null,
          }
        }
      }

      // 2. If session disconnected in gateway, trigger start
      if (channelDetails.connectionStatus !== 'connected') {
        const startRes = await fetch(`${gatewayUrl}/api/sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, channelId, inboxId }),
          signal: AbortSignal.timeout(2000),
        })

        if (startRes.ok) {
          const startData = (await startRes.json()) as {
            status: string
            qrCode?: string | null
            phoneNumber?: string | null
          }
          if (startData.qrCode) {
            return {
              sessionId,
              connectionStatus: 'qr_ready',
              qrCode: startData.qrCode,
              phoneNumber: null,
            }
          }
          return {
            sessionId,
            connectionStatus: startData.status || 'connecting',
            qrCode: null,
            phoneNumber: null,
          }
        }
      }
    } catch {
      // Gateway unreachable or timed out; fallback to local DB state
    }

    return {
      sessionId: channelDetails.sessionId,
      connectionStatus: channelDetails.connectionStatus,
      qrCode: channelDetails.qrCode || null,
      phoneNumber: channelDetails.phoneNumber || null,
    }
  }

  async disconnectChannel(inboxId: string): Promise<Record<string, unknown> | null> {
    const inboxResult = await this.getInboxById(inboxId)
    if (!inboxResult || inboxResult.inbox.channelType !== 'whatsapp_unofficial') {
      return null
    }

    const channel = inboxResult.channel as WhatsAppUnofficialChannelData
    channel.connectionStatus = 'disconnected'
    channel.qrCode = null

    // Notify wa-gateway to terminate socket session
    const gatewayPort = Number(process.env.PORT_GATEWAY || 8801)
    const gatewayUrl = `http://127.0.0.1:${gatewayPort}`
    try {
      await fetch(`${gatewayUrl}/api/sessions/${channel.sessionId}/disconnect`, {
        method: 'POST',
        signal: AbortSignal.timeout(1500),
      })
    } catch {
      // ignore network errors
    }

    try {
      await sql`
        UPDATE channels_whatsapp_unofficial
        SET connection_status = 'disconnected', qr_code = NULL, updated_at = NOW()
        WHERE id = ${channel.id}
      `
    } catch {
      // Fallback
    }

    return {
      success: true,
      connectionStatus: 'disconnected',
    }
  }

  async listInboxMembers(inboxId: string): Promise<InboxMemberRecord[]> {
    try {
      const rows = await sql`
        SELECT id, inbox_id as "inboxId", user_id as "userId", created_at as "createdAt"
        FROM inbox_members
        WHERE inbox_id = ${inboxId}
      `
      if (rows.length > 0) return rows as InboxMemberRecord[]
    } catch {
      // Fallback
    }

    return memoryStore.members.get(inboxId) || []
  }

  async addInboxMember(inboxId: string, userId: string): Promise<InboxMemberRecord> {
    const memberId = crypto.randomUUID()
    const now = new Date().toISOString()
    const memberRecord: InboxMemberRecord = {
      id: memberId,
      inboxId,
      userId,
      createdAt: now,
    }

    try {
      await sql`
        INSERT INTO inbox_members (id, inbox_id, user_id, created_at)
        VALUES (${memberId}, ${inboxId}, ${userId}, ${now})
        ON CONFLICT (inbox_id, user_id) DO NOTHING
      `
    } catch {
      // Fallback
    }

    const currentMembers = memoryStore.members.get(inboxId) || []
    if (!currentMembers.some((m) => m.userId === userId)) {
      currentMembers.push(memberRecord)
      memoryStore.members.set(inboxId, currentMembers)
    }

    return memberRecord
  }

  async removeInboxMember(inboxId: string, userId: string): Promise<boolean> {
    try {
      await sql`
        DELETE FROM inbox_members
        WHERE inbox_id = ${inboxId} AND user_id = ${userId}
      `
    } catch {
      // Fallback
    }

    const currentMembers = memoryStore.members.get(inboxId) || []
    memoryStore.members.set(
      inboxId,
      currentMembers.filter((m) => m.userId !== userId),
    )
    return true
  }

  async findInboxByWebsiteToken(
    websiteToken: string,
  ): Promise<{ inbox: Inbox; channel: WebWidgetChannelData } | null> {
    if (!websiteToken) return null

    // 1. Check PostgreSQL DB
    try {
      const rows = await sql`
        SELECT
          i.id, i.name, i.channel_type as "channelType", i.channel_id as "channelId",
          i.enable_auto_assign as "enableAutoAssign", i.greeting_enabled as "greetingEnabled",
          i.greeting_message as "greetingMessage", i.working_hours_enabled as "workingHoursEnabled",
          i.working_hours as "workingHours", i.out_of_office_message as "outOfOfficeMessage",
          i.lock_to_single_conv as "lockToSingleConv", i.sender_name_type as "senderNameType",
          i.created_at as "createdAt", i.updated_at as "updatedAt",
          c.id as "c_id", c.website_token as "c_websiteToken", c.website_url as "c_websiteUrl",
          c.allowed_domains as "c_allowedDomains", c.widget_color as "c_widgetColor",
          c.reply_time as "c_replyTime", c.pre_chat_form_enabled as "c_preChatFormEnabled",
          c.created_at as "c_createdAt", c.updated_at as "c_updatedAt"
        FROM inboxes i
        JOIN channels_web_widget c ON i.channel_id = c.id
        WHERE c.website_token = ${websiteToken}
        LIMIT 1
      `
      if (rows.length > 0) {
        const row = rows[0] as Record<string, unknown>
        const inbox: Inbox = {
          id: row.id as string,
          name: row.name as string,
          channelType: row.channelType as Inbox['channelType'],
          channelId: row.channelId as string,
          enableAutoAssign: row.enableAutoAssign as boolean,
          greetingEnabled: row.greetingEnabled as boolean,
          greetingMessage: (row.greetingMessage as string) || null,
          workingHoursEnabled: row.workingHoursEnabled as boolean,
          workingHours: (row.workingHours as Record<string, unknown>) || {},
          outOfOfficeMessage: (row.outOfOfficeMessage as string) || null,
          lockToSingleConv: row.lockToSingleConv as boolean,
          senderNameType: row.senderNameType as Inbox['senderNameType'],
          createdAt: row.createdAt as string,
          updatedAt: row.updatedAt as string,
        }
        const channel: WebWidgetChannelData = {
          id: row.c_id as string,
          websiteToken: row.c_websiteToken as string,
          websiteUrl: (row.c_websiteUrl as string) || null,
          allowedDomains: (row.c_allowedDomains as string[]) || [],
          widgetColor: (row.c_widgetColor as string) || '#00a884',
          replyTime: (row.c_replyTime as string) || 'in_a_few_minutes',
          preChatFormEnabled: row.c_preChatFormEnabled as boolean,
          createdAt: row.c_createdAt as string,
          updatedAt: row.c_updatedAt as string,
        }
        return { inbox, channel }
      }
    } catch {
      // Fallback
    }

    // 2. Check memoryStore
    for (const [, entry] of memoryStore.channels.entries()) {
      if (entry.type === 'web_widget') {
        const widgetChannel = entry.data as WebWidgetChannelData
        if (widgetChannel.websiteToken === websiteToken) {
          const inbox = Array.from(memoryStore.inboxes.values()).find(
            (i) => i.channelId === widgetChannel.id,
          )
          if (inbox) {
            return { inbox, channel: widgetChannel }
          }
        }
      }
    }

    return null
  }
}

export const inboxService = new InboxService()
export default inboxService
