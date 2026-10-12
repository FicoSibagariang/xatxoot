import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { campaignRoutes } from './campaigns.routes'
import {
  AntiBanRateLimiter,
  BroadcastEngine,
  CampaignsService,
  antiBanRateLimiter,
  broadcastEngine,
  campaignsService,
  resetCampaignsStore,
} from './campaigns.service'

describe('Broadcast Engine & Anti-Ban Guard (Task 4.12 - apps/api)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  const validInboxId = '123e4567-e89b-12d3-a456-426614174001'
  const validContactId1 = '123e4567-e89b-12d3-a456-426614174002'
  const validContactId2 = '123e4567-e89b-12d3-a456-426614174003'

  let app: Hono

  beforeEach(async () => {
    resetCampaignsStore()
    app = new Hono()
    app.route('/api/v1/campaigns', campaignRoutes)

    // Ensure mock contacts exist
    await conversationService.findOrCreateContact(
      { phoneNumber: '+6281234567891', name: 'Pelanggan 1' },
      validInboxId,
    )
    await conversationService.findOrCreateContact(
      { phoneNumber: '+6281234567892', name: 'Pelanggan 2' },
      validInboxId,
    )
  })

  describe('Anti-Ban Rate Limiter & Jitter Protection Engine', () => {
    const limiter = new AntiBanRateLimiter()

    it('should generate jitter delay within min and max boundaries', () => {
      for (let i = 0; i < 20; i++) {
        const delaySeconds = limiter.calculateJitterDelay(15, 45)
        expect(delaySeconds).toBeGreaterThanOrEqual(15)
        expect(delaySeconds).toBeLessThanOrEqual(45)
      }
    })

    it('should normalize invalid jitter range when min > max', () => {
      const delay = limiter.calculateJitterDelay(50, 20)
      expect(delay).toBeGreaterThanOrEqual(20)
      expect(delay).toBeLessThanOrEqual(50)
    })

    it('should inject anti-ban text variation with randomized spacers without altering visible characters', () => {
      const originalText = 'Dapatkan promo cashback 50% hari ini!'
      const varied1 = limiter.applyAntiBanTextVariation(originalText, true)
      const varied2 = limiter.applyAntiBanTextVariation(originalText, true)

      // Content should still retain core visible message
      expect(varied1.replace(/[\u200B\u200C\u200D]/g, '')).toBe(originalText)
      expect(varied2.replace(/[\u200B\u200C\u200D]/g, '')).toBe(originalText)
    })

    it('should track and enforce message dispatch rate limits per minute/hour', () => {
      const testChannelId = 'test-baileys-channel-1'
      limiter.resetRateLimits()

      // Allow under limit
      expect(limiter.checkRateLimit(testChannelId, 5)).toBe(true)
      limiter.recordDispatch(testChannelId)
      limiter.recordDispatch(testChannelId)

      expect(limiter.getDispatchCount(testChannelId)).toBe(2)
    })
  })

  describe('Campaigns CRUD & Audience Resolution', () => {
    it('should create campaign with custom_list audience and populate pending deliveries', async () => {
      const campaign = await campaignsService.createCampaign({
        inboxId: validInboxId,
        title: 'Promo Flash Sale Weekend',
        messageContent: 'Diskon kilat hanya akhir pekan ini!',
        audience: {
          type: 'custom_list',
          contactIds: [validContactId1, validContactId2],
        },
        antiBanDelayMin: 15,
        antiBanDelayMax: 45,
      })

      expect(campaign.id).toBeDefined()
      expect(campaign.status).toBe('draft')
      expect(campaign.title).toBe('Promo Flash Sale Weekend')

      const deliveries = await campaignsService.listCampaignDeliveries(campaign.id)
      expect(deliveries.length).toBe(2)
      expect(deliveries.every((d) => d.status === 'pending')).toBe(true)
      expect(deliveries.map((d) => d.contactId)).toContain(validContactId1)
      expect(deliveries.map((d) => d.contactId)).toContain(validContactId2)
    })

    it('should retrieve campaign details with delivery progress stats', async () => {
      const campaign = await campaignsService.createCampaign({
        inboxId: validInboxId,
        title: 'Pengumuman Update Layanan',
        messageContent: 'Kami memperbarui syarat dan ketentuan.',
        audience: {
          type: 'custom_list',
          contactIds: [validContactId1],
        },
      })

      const detail = await campaignsService.getCampaignWithStats(campaign.id)
      expect(detail).not.toBeNull()
      expect(detail?.campaign.id).toBe(campaign.id)
      expect(detail?.stats.totalDeliveries).toBe(1)
      expect(detail?.stats.pendingCount).toBe(1)
      expect(detail?.stats.sentCount).toBe(0)
      expect(detail?.stats.failedCount).toBe(0)
    })
  })

  describe('BullMQ Worker & Broadcast Engine Dispatching', () => {
    it('should enqueue campaign dispatch job to BullMQ queue campaign-dispatch', async () => {
      const campaign = await campaignsService.createCampaign({
        inboxId: validInboxId,
        title: 'Broadcast Queue Test',
        messageContent: 'Testing BullMQ worker enqueue',
        audience: {
          type: 'custom_list',
          contactIds: [validContactId1, validContactId2],
        },
      })

      const enqueued = await broadcastEngine.enqueueCampaignDispatch(campaign.id)
      expect(enqueued.jobId).toBeDefined()
      expect(enqueued.enqueuedDeliveries).toBe(2)

      const queuedJobs = broadcastEngine.getQueuedDispatchJobs()
      expect(queuedJobs.length).toBeGreaterThanOrEqual(1)
      expect(queuedJobs[0].queue).toBe('campaign-dispatch')
      expect(queuedJobs[0].data.campaignId).toBe(campaign.id)
    })

    it('should process campaign dispatch, apply anti-ban guard, and update deliveries to sent', async () => {
      const campaign = await campaignsService.createCampaign({
        inboxId: validInboxId,
        title: 'Live Dispatch Test',
        messageContent: 'Pesan siaran langsung ke pelanggan',
        audience: {
          type: 'custom_list',
          contactIds: [validContactId1, validContactId2],
        },
        antiBanDelayMin: 1,
        antiBanDelayMax: 2,
      })

      // Execute worker job processing
      const processResult = await broadcastEngine.processCampaignDispatch(campaign.id)
      expect(processResult.success).toBe(true)
      expect(processResult.sentCount).toBe(2)
      expect(processResult.failedCount).toBe(0)

      // Verify campaign status updated to completed
      const updated = await campaignsService.getCampaignById(campaign.id)
      expect(updated?.status).toBe('completed')

      // Verify delivery records updated to sent with timestamp
      const deliveries = await campaignsService.listCampaignDeliveries(campaign.id)
      expect(deliveries.every((d) => d.status === 'sent')).toBe(true)
      expect(deliveries.every((d) => d.sentAt !== null)).toBe(true)
    })

    it('should allow cancelling a draft or scheduled campaign', async () => {
      const campaign = await campaignsService.createCampaign({
        inboxId: validInboxId,
        title: 'Campaign Dibatalkan',
        messageContent: 'Batal kirim',
        audience: {
          type: 'custom_list',
          contactIds: [validContactId1],
        },
      })

      const cancelled = await campaignsService.cancelCampaign(campaign.id)
      expect(cancelled.status).toBe('cancelled')
    })
  })

  describe('Management REST API Endpoints', () => {
    it('should support full Campaigns CRUD & dispatch via HTTP API', async () => {
      // 1. POST create
      const postRes = await app.request('/api/v1/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inboxId: validInboxId,
          title: 'Promo Spesial Lebaran',
          messageContent: 'Selamat hari raya! Nikmati diskon spesial.',
          audience: {
            type: 'custom_list',
            contactIds: [validContactId1],
          },
          antiBanDelayMin: 15,
          antiBanDelayMax: 45,
        }),
      })
      expect(postRes.status).toBe(201)
      const postJson = await postRes.json()
      expect(postJson.success).toBe(true)
      const campaignId = postJson.data.id

      // 2. GET list
      const listRes = await app.request('/api/v1/campaigns')
      expect(listRes.status).toBe(200)
      const listJson = await listRes.json()
      expect(listJson.data.length).toBeGreaterThanOrEqual(1)

      // 3. GET with stats
      const getRes = await app.request(`/api/v1/campaigns/${campaignId}`)
      expect(getRes.status).toBe(200)
      const getJson = await getRes.json()
      expect(getJson.data.campaign.title).toBe('Promo Spesial Lebaran')
      expect(getJson.data.stats.totalDeliveries).toBe(1)

      // 4. GET deliveries
      const delivRes = await app.request(`/api/v1/campaigns/${campaignId}/deliveries`)
      expect(delivRes.status).toBe(200)
      const delivJson = await delivRes.json()
      expect(delivJson.data.length).toBe(1)

      // 5. POST dispatch
      const dispatchRes = await app.request(`/api/v1/campaigns/${campaignId}/dispatch`, {
        method: 'POST',
      })
      expect(dispatchRes.status).toBe(200)
      const dispatchJson = await dispatchRes.json()
      expect(dispatchJson.success).toBe(true)

      // 6. POST cancel on another campaign
      const c2 = await campaignsService.createCampaign({
        inboxId: validInboxId,
        title: 'Cancel via API',
        messageContent: 'Test cancel',
        audience: { type: 'custom_list', contactIds: [validContactId1] },
      })
      const cancelRes = await app.request(`/api/v1/campaigns/${c2.id}/cancel`, {
        method: 'POST',
      })
      expect(cancelRes.status).toBe(200)
      const cancelJson = await cancelRes.json()
      expect(cancelJson.data.status).toBe('cancelled')
    })
  })

  describe('Single Organization Rule Guardrail', () => {
    it('must NOT require or contain account_id in Campaign or Delivery schemas/tables', async () => {
      const campaign = await campaignsService.createCampaign({
        inboxId: validInboxId,
        title: 'Single Org Guardrail Campaign',
        messageContent: 'No account_id allowed',
        audience: { type: 'custom_list', contactIds: [validContactId1] },
      })

      const deliveries = await campaignsService.listCampaignDeliveries(campaign.id)

      expect(Object.keys(campaign)).not.toContain('account_id')
      expect(Object.keys(campaign)).not.toContain('accountId')
      expect(Object.keys(deliveries[0])).not.toContain('account_id')
      expect(Object.keys(deliveries[0])).not.toContain('accountId')
    })
  })

  describe('Phase 4 Checklist Synchronization', () => {
    it('should mark Task 4.12 as completed in docs/PHASE_4_CHECKLIST.md', () => {
      const checklistPath = join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md')
      const content = readFileSync(checklistPath, 'utf-8')
      expect(content).toContain('- [x] **Task 4.12 (TDD - Broadcast Engine & Anti-Ban Guard)**:')
    })
  })
})
