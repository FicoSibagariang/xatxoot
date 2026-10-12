import type {
  Campaign,
  CampaignDelivery,
  CampaignStatus,
  CreateCampaignInput,
} from '@xatxoot/shared'
import { sql } from '../../db'
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

const memoryStore = {
  campaigns: new Map<string, Campaign>(),
  deliveries: new Map<string, CampaignDelivery>(),
  queuedDispatchJobs: [] as QueuedCampaignDispatchJob[],
}

export function resetCampaignsStore(): void {
  memoryStore.campaigns.clear()
  memoryStore.deliveries.clear()
  memoryStore.queuedDispatchJobs = []
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

    const campaign: Campaign = {
      id,
      inboxId: input.inboxId,
      title: input.title,
      messageContent: input.messageContent,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
      status: 'draft',
      antiBanDelayMin,
      antiBanDelayMax,
      audience: input.audience,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.campaigns.set(id, campaign)

    try {
      await sql`
        INSERT INTO campaigns (
          id, inbox_id, title, message_content, scheduled_at, status,
          anti_ban_delay_min, anti_ban_delay_max, created_at, updated_at
        ) VALUES (
          ${campaign.id}, ${campaign.inboxId}, ${campaign.title}, ${campaign.messageContent},
          ${campaign.scheduledAt}, ${campaign.status}, ${campaign.antiBanDelayMin},
          ${campaign.antiBanDelayMax}, ${campaign.createdAt}, ${campaign.updatedAt}
        )
      `
    } catch {
      // Memory fallback
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

    for (const contactId of uniqueContactIds) {
      const deliveryId = crypto.randomUUID()
      const delivery: CampaignDelivery = {
        id: deliveryId,
        campaignId: campaign.id,
        contactId,
        status: 'pending',
        errorMessage: null,
        sentAt: null,
        createdAt: now,
        updatedAt: now,
      }

      memoryStore.deliveries.set(deliveryId, delivery)

      try {
        await sql`
          INSERT INTO campaign_deliveries (
            id, campaign_id, contact_id, status, error_message, sent_at, created_at, updated_at
          ) VALUES (
            ${delivery.id}, ${delivery.campaignId}, ${delivery.contactId}, ${delivery.status},
            ${delivery.errorMessage}, ${delivery.sentAt}, ${delivery.createdAt}, ${delivery.updatedAt}
          )
        `
      } catch {
        // Memory fallback
      }
    }
  }

  async listCampaigns(filter?: { inboxId?: string; status?: string }): Promise<Campaign[]> {
    try {
      let query = sql`
        SELECT
          id, inbox_id as "inboxId", title, message_content as "messageContent",
          scheduled_at as "scheduledAt", status, anti_ban_delay_min as "antiBanDelayMin",
          anti_ban_delay_max as "antiBanDelayMax", created_at as "createdAt", updated_at as "updatedAt"
        FROM campaigns
        WHERE 1 = 1
      `
      if (filter?.inboxId) {
        query = sql`${query} AND inbox_id = ${filter.inboxId}`
      }
      if (filter?.status) {
        query = sql`${query} AND status = ${filter.status}`
      }
      query = sql`${query} ORDER BY created_at DESC`
      const rows = await query
      if (rows && rows.length > 0) {
        return rows as unknown as Campaign[]
      }
    } catch {
      // Memory fallback
    }

    let campaigns = Array.from(memoryStore.campaigns.values())
    if (filter?.inboxId) {
      campaigns = campaigns.filter((c) => c.inboxId === filter.inboxId)
    }
    if (filter?.status) {
      campaigns = campaigns.filter((c) => c.status === filter.status)
    }
    return campaigns
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    try {
      const rows = await sql`
        SELECT
          id, inbox_id as "inboxId", title, message_content as "messageContent",
          scheduled_at as "scheduledAt", status, anti_ban_delay_min as "antiBanDelayMin",
          anti_ban_delay_max as "antiBanDelayMax", created_at as "createdAt", updated_at as "updatedAt"
        FROM campaigns
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as Campaign
      }
    } catch {
      // Memory fallback
    }

    return memoryStore.campaigns.get(id) || null
  }

  async listCampaignDeliveries(campaignId: string): Promise<CampaignDelivery[]> {
    try {
      const rows = await sql`
        SELECT
          id, campaign_id as "campaignId", contact_id as "contactId", status,
          error_message as "errorMessage", sent_at as "sentAt",
          created_at as "createdAt", updated_at as "updatedAt"
        FROM campaign_deliveries
        WHERE campaign_id = ${campaignId}
        ORDER BY created_at ASC
      `
      if (rows && rows.length > 0) {
        return rows as unknown as CampaignDelivery[]
      }
    } catch {
      // Memory fallback
    }

    return Array.from(memoryStore.deliveries.values()).filter((d) => d.campaignId === campaignId)
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
    const existing = await this.getCampaignById(id)
    if (!existing) {
      throw new Error(`Campaign not found: ${id}`)
    }

    const now = new Date().toISOString()
    const updated: Campaign = {
      ...existing,
      status,
      updatedAt: now,
    }

    memoryStore.campaigns.set(id, updated)

    try {
      await sql`UPDATE campaigns SET status = ${status}, updated_at = ${now} WHERE id = ${id}`
    } catch {
      // Memory fallback
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
    const delivery = memoryStore.deliveries.get(deliveryId)
    if (!delivery) return null

    const now = new Date().toISOString()
    delivery.status = status
    delivery.errorMessage = errorMessage ?? null
    if (status === 'sent') {
      delivery.sentAt = now
    }
    delivery.updatedAt = now
    memoryStore.deliveries.set(deliveryId, delivery)

    try {
      await sql`
        UPDATE campaign_deliveries
        SET status = ${status}, error_message = ${delivery.errorMessage}, sent_at = ${delivery.sentAt}, updated_at = ${now}
        WHERE id = ${deliveryId}
      `
    } catch {
      // Memory fallback
    }

    return delivery
  }
}

export const campaignsService = new CampaignsService()

// ==========================================
// Broadcast Engine & BullMQ Worker
// ==========================================

export class BroadcastEngine {
  private limiter: AntiBanRateLimiter

  constructor(limiter?: AntiBanRateLimiter) {
    this.limiter = limiter || antiBanRateLimiter
  }

  getQueuedDispatchJobs(): QueuedCampaignDispatchJob[] {
    return [...memoryStore.queuedDispatchJobs]
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

    memoryStore.queuedDispatchJobs.push(job)

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
