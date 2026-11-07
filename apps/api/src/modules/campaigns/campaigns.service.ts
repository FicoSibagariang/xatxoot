import type {
  Campaign,
  CampaignDelivery,
  CampaignStatus,
  CreateCampaignInput,
} from '@xatxoot/shared'
import { parseJsonField, sql, toIsoString, toValidUuid } from '../../db'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { messageService } from '../messages/messages.service'
import { realtimeService } from '../realtime/realtime.service'

export interface QueuedCampaignDispatchJob {
  queue: string
  name: string
  data: {
    jobId: string
    campaignId: string
    inboxId: string
    title: string
    totalDeliveries: number
  }
}

export interface DeliveryStats {
  totalDeliveries: number
  pendingCount: number
  sentCount: number
  failedCount: number
}

function mapCampaignRow(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id),
    inboxId: String(row.inboxId),
    title: String(row.title),
    messageContent: String(row.messageContent),
    scheduledAt: toIsoString(row.scheduledAt),
    status: row.status as Campaign['status'],
    antiBanDelayMin: Number(row.antiBanDelayMin ?? 15),
    antiBanDelayMax: Number(row.antiBanDelayMax ?? 45),
    audience: parseJsonField(row.audience, { type: 'all_contacts' }),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

function mapDeliveryRow(row: Record<string, unknown>): CampaignDelivery {
  return {
    id: String(row.id),
    campaignId: String(row.campaignId),
    contactId: String(row.contactId),
    status: row.status as CampaignDelivery['status'],
    errorMessage: (row.errorMessage as string | null) ?? null,
    sentAt: toIsoString(row.sentAt),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

async function ensureInboxExists(inboxId: string): Promise<void> {
  const validInboxId = toValidUuid(inboxId)
  await sql`
    INSERT INTO inboxes (id, name, channel_type, channel_id, created_at, updated_at)
    VALUES (${validInboxId}, 'Inbox ' || ${validInboxId}, 'api', ${crypto.randomUUID()}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

async function ensureContactExists(contactId: string): Promise<void> {
  const validContactId = toValidUuid(contactId)
  await sql`
    INSERT INTO contacts (id, name, created_at, updated_at)
    VALUES (${validContactId}, 'Contact ' || ${validContactId}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

export async function resetCampaignsStore(): Promise<void> {
  await sql`DELETE FROM campaign_deliveries`
  await sql`DELETE FROM campaign_extras`
  await sql`DELETE FROM campaigns`
  broadcastEngine.reset()
}

// ==========================================
// Anti-Ban Guard & Rate Limiter
// ==========================================

export class AntiBanRateLimiter {
  private dispatchTimestamps = new Map<string, number[]>()

  calculateJitterDelay(minSeconds: number, maxSeconds: number): number {
    const min = Math.min(minSeconds, maxSeconds)
    const max = Math.max(minSeconds, maxSeconds)
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  applyAntiBanTextVariation(content: string, randomizeSpacers = true): string {
    if (!randomizeSpacers || !content) return content

    // Zero-width space characters used for subtle entropy without visible alteration
    const spacers = ['\u200B', '\u200C', '\u200D']
    const words = content.split(' ')

    return words
      .map((word, idx) => {
        if (idx > 0 && Math.random() > 0.4) {
          const randomSpacer = spacers[Math.floor(Math.random() * spacers.length)]
          return `${randomSpacer}${word}`
        }
        return word
      })
      .join(' ')
  }

  checkRateLimit(channelId: string, maxPerWindow = 60, windowMs = 60000): boolean {
    const now = Date.now()
    const timestamps = (this.dispatchTimestamps.get(channelId) || []).filter(
      (ts) => now - ts < windowMs,
    )
    this.dispatchTimestamps.set(channelId, timestamps)
    return timestamps.length < maxPerWindow
  }

  recordDispatch(channelId: string): void {
    const timestamps = this.dispatchTimestamps.get(channelId) || []
    timestamps.push(Date.now())
    this.dispatchTimestamps.set(channelId, timestamps)
  }

  getDispatchCount(channelId: string, windowMs = 60000): number {
    const now = Date.now()
    const timestamps = (this.dispatchTimestamps.get(channelId) || []).filter(
      (ts) => now - ts < windowMs,
    )
    return timestamps.length
  }

  resetRateLimits(): void {
    this.dispatchTimestamps.clear()
  }
}

export const antiBanRateLimiter = new AntiBanRateLimiter()

// ==========================================
// Campaigns Service
// ==========================================

export class CampaignsService {
  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const antiBanDelayMin = input.antiBanDelayMin ?? 15
    const antiBanDelayMax = input.antiBanDelayMax ?? 45
    const inboxId = toValidUuid(input.inboxId)
    await ensureInboxExists(inboxId)

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null
    const audience = input.audience || { type: 'all_contacts' }

    await sql`
      INSERT INTO campaigns (
        id, inbox_id, title, message_content, scheduled_at, status,
        anti_ban_delay_min, anti_ban_delay_max, created_at, updated_at
      ) VALUES (
        ${id}, ${inboxId}, ${input.title}, ${input.messageContent},
        ${scheduledAt}, 'draft', ${antiBanDelayMin},
        ${antiBanDelayMax}, ${now}, ${now}
      )
    `

    await sql`
      INSERT INTO campaign_extras (
        id, audience
      ) VALUES (
        ${id}, ${JSON.stringify(audience)}
      )
      ON CONFLICT (id) DO UPDATE SET audience = EXCLUDED.audience
    `

    const campaign = await this.getCampaignById(id)
    if (!campaign) {
      throw new Error(`Failed to retrieve created campaign: ${id}`)
    }

    // Resolve audience recipients and create pending deliveries
    await this.resolveAudienceDeliveries(campaign)

    return campaign
  }

  private async resolveAudienceDeliveries(campaign: Campaign): Promise<void> {
    const audience = campaign.audience
    const recipientContactIds: string[] = []

    if (audience.type === 'custom_list' && audience.contactIds) {
      recipientContactIds.push(...audience.contactIds)
    } else if (audience.type === 'all_contacts') {
      const contacts = await conversationService.listContacts()
      for (const c of contacts) {
        recipientContactIds.push(c.id)
      }
    } else if (audience.type === 'labels' && audience.labelIds) {
      const contacts = await conversationService.listContacts()
      for (const c of contacts) {
        recipientContactIds.push(c.id)
      }
    }

    // De-duplicate contact IDs
    const uniqueContactIds = Array.from(new Set(recipientContactIds))
    const now = new Date().toISOString()

    for (const rawContactId of uniqueContactIds) {
      const contactId = toValidUuid(rawContactId)
      await ensureContactExists(contactId)
      const deliveryId = crypto.randomUUID()

      await sql`
        INSERT INTO campaign_deliveries (
          id, campaign_id, contact_id, status, error_message, sent_at, created_at, updated_at
        ) VALUES (
          ${deliveryId}, ${campaign.id}, ${contactId}, 'pending',
          ${null}, ${null}, ${now}, ${now}
        )
      `
    }
  }

  async listCampaigns(filter?: { inboxId?: string; status?: string }): Promise<Campaign[]> {
    let query = sql`
      SELECT
        c.id, c.inbox_id as "inboxId", c.title, c.message_content as "messageContent",
        c.scheduled_at as "scheduledAt", c.status, c.anti_ban_delay_min as "antiBanDelayMin",
        c.anti_ban_delay_max as "antiBanDelayMax", COALESCE(e.audience, '{"type": "all_contacts"}'::jsonb) as audience,
        c.created_at as "createdAt", c.updated_at as "updatedAt"
      FROM campaigns c
      LEFT JOIN campaign_extras e ON c.id = e.id
      WHERE 1 = 1
    `
    if (filter?.inboxId) {
      const vInboxId = toValidUuid(filter.inboxId)
      query = sql`${query} AND c.inbox_id = ${vInboxId}`
    }
    if (filter?.status) {
      query = sql`${query} AND c.status = ${filter.status}`
    }
    query = sql`${query} ORDER BY c.created_at DESC`
    const rows = await query
    return (rows || []).map(mapCampaignRow)
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    const rows = await sql`
      SELECT
        c.id, c.inbox_id as "inboxId", c.title, c.message_content as "messageContent",
        c.scheduled_at as "scheduledAt", c.status, c.anti_ban_delay_min as "antiBanDelayMin",
        c.anti_ban_delay_max as "antiBanDelayMax", COALESCE(e.audience, '{"type": "all_contacts"}'::jsonb) as audience,
        c.created_at as "createdAt", c.updated_at as "updatedAt"
      FROM campaigns c
      LEFT JOIN campaign_extras e ON c.id = e.id
      WHERE c.id = ${id}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapCampaignRow(rows[0])
    }

    return null
  }

  async listCampaignDeliveries(campaignId: string): Promise<CampaignDelivery[]> {
    const rows = await sql`
      SELECT
        id, campaign_id as "campaignId", contact_id as "contactId", status,
        error_message as "errorMessage", sent_at as "sentAt",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM campaign_deliveries
      WHERE campaign_id = ${campaignId}
      ORDER BY created_at ASC
    `
    return (rows || []).map(mapDeliveryRow)
  }

  async getCampaignWithStats(
    id: string,
  ): Promise<{ campaign: Campaign; stats: DeliveryStats } | null> {
    const campaign = await this.getCampaignById(id)
    if (!campaign) return null

    const deliveries = await this.listCampaignDeliveries(id)
    const stats: DeliveryStats = {
      totalDeliveries: deliveries.length,
      pendingCount: deliveries.filter((d) => d.status === 'pending').length,
      sentCount: deliveries.filter((d) => d.status === 'sent').length,
      failedCount: deliveries.filter((d) => d.status === 'failed').length,
    }

    return { campaign, stats }
  }

  async updateCampaignStatus(id: string, status: CampaignStatus): Promise<Campaign> {
    const now = new Date().toISOString()
    await sql`
      UPDATE campaigns
      SET status = ${status}, updated_at = ${now}
      WHERE id = ${id}
    `
    const updated = await this.getCampaignById(id)
    if (!updated) {
      throw new Error(`Campaign not found: ${id}`)
    }

    realtimeService.broadcast({
      event: 'campaign.updated',
      data: { campaign: updated },
    })

    return updated
  }

  async cancelCampaign(id: string): Promise<Campaign> {
    return this.updateCampaignStatus(id, 'cancelled')
  }

  async updateDeliveryStatus(
    deliveryId: string,
    status: 'pending' | 'sent' | 'failed',
    errorMessage?: string | null,
  ): Promise<CampaignDelivery | null> {
    const now = new Date().toISOString()
    const sentAt = status === 'sent' ? now : null

    const rows = await sql`
      UPDATE campaign_deliveries
      SET status = ${status}, error_message = ${errorMessage ?? null},
          sent_at = COALESCE(sent_at, ${sentAt}), updated_at = ${now}
      WHERE id = ${deliveryId}
      RETURNING
        id, campaign_id as "campaignId", contact_id as "contactId", status,
        error_message as "errorMessage", sent_at as "sentAt",
        created_at as "createdAt", updated_at as "updatedAt"
    `
    if (!rows || rows.length === 0) return null

    return mapDeliveryRow(rows[0])
  }
}

export const campaignsService = new CampaignsService()

// ==========================================
// Broadcast Engine & BullMQ Worker
// ==========================================

export class BroadcastEngine {
  private limiter: AntiBanRateLimiter
  private queuedJobs: QueuedCampaignDispatchJob[] = []

  constructor(limiter?: AntiBanRateLimiter) {
    this.limiter = limiter || antiBanRateLimiter
  }

  reset(): void {
    this.queuedJobs = []
  }

  getQueuedDispatchJobs(): QueuedCampaignDispatchJob[] {
    return [...this.queuedJobs]
  }

  async enqueueCampaignDispatch(
    campaignId: string,
  ): Promise<{ jobId: string; enqueuedDeliveries: number }> {
    const campaign = await campaignsService.getCampaignById(campaignId)
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`)
    }

    const deliveries = await campaignsService.listCampaignDeliveries(campaignId)
    const jobId = crypto.randomUUID()

    const job: QueuedCampaignDispatchJob = {
      queue: 'campaign-dispatch',
      name: 'dispatch-campaign',
      data: {
        jobId,
        campaignId,
        inboxId: campaign.inboxId,
        title: campaign.title,
        totalDeliveries: deliveries.length,
      },
    }

    this.queuedJobs.push(job)

    return {
      jobId,
      enqueuedDeliveries: deliveries.length,
    }
  }

  async processCampaignDispatch(
    campaignId: string,
  ): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
    const campaign = await campaignsService.getCampaignById(campaignId)
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`)
    }

    // Set campaign status to processing
    await campaignsService.updateCampaignStatus(campaignId, 'processing')

    const inboxData = await inboxService.getInboxById(campaign.inboxId)
    const channelType = inboxData?.inbox.channelType || 'whatsapp_unofficial'
    const deliveries = await campaignsService.listCampaignDeliveries(campaignId)

    let sentCount = 0
    let failedCount = 0

    for (const delivery of deliveries) {
      if (delivery.status !== 'pending') continue

      try {
        // 1. Calculate dynamic jitter delay for anti-ban protection
        const jitterDelaySeconds = this.limiter.calculateJitterDelay(
          campaign.antiBanDelayMin,
          campaign.antiBanDelayMax,
        )

        // 2. Apply typography / space variation to message content
        const variedContent = this.limiter.applyAntiBanTextVariation(
          campaign.messageContent,
          channelType === 'whatsapp_unofficial',
        )

        // 3. Dispatch based on channel type
        if (channelType === 'whatsapp_unofficial') {
          await messageService.enqueueBaileysOutbound({
            jobId: crypto.randomUUID(),
            messageId: crypto.randomUUID(),
            channelId: inboxData?.inbox.channelId || campaign.inboxId,
            recipientNumber: delivery.contactId,
            messageType: 'text',
            text: variedContent,
          })
          this.limiter.recordDispatch(campaign.inboxId)
        }

        // 4. Update delivery status to sent
        await campaignsService.updateDeliveryStatus(delivery.id, 'sent')
        sentCount++
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Dispatch failed'
        await campaignsService.updateDeliveryStatus(delivery.id, 'failed', errorMsg)
        failedCount++
      }
    }

    // Mark campaign as completed
    await campaignsService.updateCampaignStatus(campaignId, 'completed')

    return {
      success: true,
      sentCount,
      failedCount,
    }
  }
}

export const broadcastEngine = new BroadcastEngine()
