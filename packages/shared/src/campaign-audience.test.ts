import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CampaignAntiBanConfigSchema,
  CampaignAudienceSelectorSchema,
  CampaignAudienceTypeSchema,
  CampaignDeliverySchema,
  CampaignDeliveryStatusSchema,
  CampaignSchema,
  CampaignStatusSchema,
  CreateCampaignDeliveryInputSchema,
  CreateCampaignInputSchema,
  UpdateCampaignInputSchema,
} from './schemas'

describe('Campaign & Broadcast Audience Selector Validation Schemas (Task 4.8 - packages/shared)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..')
  const validInboxId = '123e4567-e89b-12d3-a456-426614174001'
  const validCampaignId = '123e4567-e89b-12d3-a456-426614174002'
  const validContactId1 = '123e4567-e89b-12d3-a456-426614174003'
  const validContactId2 = '123e4567-e89b-12d3-a456-426614174004'
  const validLabelId1 = '123e4567-e89b-12d3-a456-426614174005'
  const validLabelId2 = '123e4567-e89b-12d3-a456-426614174006'

  describe('CampaignStatusSchema', () => {
    it('should accept valid campaign status values', () => {
      const validStatuses = ['draft', 'scheduled', 'processing', 'completed', 'cancelled', 'failed']
      for (const status of validStatuses) {
        expect(CampaignStatusSchema.safeParse(status).success).toBe(true)
      }
    })

    it('should reject invalid status values', () => {
      expect(CampaignStatusSchema.safeParse('archived').success).toBe(false)
      expect(CampaignStatusSchema.safeParse('pending').success).toBe(false)
      expect(CampaignStatusSchema.safeParse('').success).toBe(false)
    })
  })

  describe('CampaignDeliveryStatusSchema', () => {
    it('should accept valid delivery status values', () => {
      const validStatuses = ['pending', 'sent', 'failed']
      for (const status of validStatuses) {
        expect(CampaignDeliveryStatusSchema.safeParse(status).success).toBe(true)
      }
    })

    it('should reject invalid delivery status values', () => {
      expect(CampaignDeliveryStatusSchema.safeParse('delivered').success).toBe(false)
      expect(CampaignDeliveryStatusSchema.safeParse('queued').success).toBe(false)
      expect(CampaignDeliveryStatusSchema.safeParse('').success).toBe(false)
    })
  })

  describe('CampaignAudienceTypeSchema', () => {
    it('should accept valid audience types', () => {
      const validTypes = ['all_contacts', 'labels', 'custom_list']
      for (const type of validTypes) {
        expect(CampaignAudienceTypeSchema.safeParse(type).success).toBe(true)
      }
    })

    it('should reject invalid audience types', () => {
      expect(CampaignAudienceTypeSchema.safeParse('segments').success).toBe(false)
      expect(CampaignAudienceTypeSchema.safeParse('').success).toBe(false)
    })
  })

  describe('CampaignAudienceSelectorSchema', () => {
    it('should accept audience all_contacts without specific IDs', () => {
      const res = CampaignAudienceSelectorSchema.safeParse({
        type: 'all_contacts',
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.type).toBe('all_contacts')
      }
    })

    it('should accept audience labels with non-empty labelIds array', () => {
      const res = CampaignAudienceSelectorSchema.safeParse({
        type: 'labels',
        labelIds: [validLabelId1, validLabelId2],
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.labelIds).toHaveLength(2)
      }
    })

    it('should reject audience labels with empty labelIds', () => {
      const res = CampaignAudienceSelectorSchema.safeParse({
        type: 'labels',
        labelIds: [],
      })
      expect(res.success).toBe(false)
    })

    it('should reject audience labels without labelIds provided', () => {
      const res = CampaignAudienceSelectorSchema.safeParse({
        type: 'labels',
      })
      expect(res.success).toBe(false)
    })

    it('should reject audience labels with invalid UUIDs', () => {
      const res = CampaignAudienceSelectorSchema.safeParse({
        type: 'labels',
        labelIds: ['not-a-uuid'],
      })
      expect(res.success).toBe(false)
    })

    it('should accept audience custom_list with non-empty contactIds array', () => {
      const res = CampaignAudienceSelectorSchema.safeParse({
        type: 'custom_list',
        contactIds: [validContactId1, validContactId2],
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.contactIds).toHaveLength(2)
      }
    })

    it('should reject audience custom_list with empty contactIds', () => {
      const res = CampaignAudienceSelectorSchema.safeParse({
        type: 'custom_list',
        contactIds: [],
      })
      expect(res.success).toBe(false)
    })

    it('should reject audience custom_list without contactIds provided', () => {
      const res = CampaignAudienceSelectorSchema.safeParse({
        type: 'custom_list',
      })
      expect(res.success).toBe(false)
    })

    it('should reject audience custom_list with invalid UUIDs', () => {
      const res = CampaignAudienceSelectorSchema.safeParse({
        type: 'custom_list',
        contactIds: ['invalid-id'],
      })
      expect(res.success).toBe(false)
    })
  })

  describe('CampaignAntiBanConfigSchema', () => {
    it('should provide default values for delays', () => {
      const res = CampaignAntiBanConfigSchema.safeParse({})
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.delayMin).toBe(15)
        expect(res.data.delayMax).toBe(45)
        expect(res.data.batchSize).toBe(50)
        expect(res.data.randomizeJitter).toBe(true)
      }
    })

    it('should accept custom valid anti-ban configuration', () => {
      const res = CampaignAntiBanConfigSchema.safeParse({
        delayMin: 20,
        delayMax: 60,
        batchSize: 25,
        randomizeJitter: false,
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.delayMin).toBe(20)
        expect(res.data.delayMax).toBe(60)
        expect(res.data.batchSize).toBe(25)
        expect(res.data.randomizeJitter).toBe(false)
      }
    })

    it('should reject when delayMin is greater than delayMax', () => {
      const res = CampaignAntiBanConfigSchema.safeParse({
        delayMin: 50,
        delayMax: 20,
      })
      expect(res.success).toBe(false)
    })

    it('should reject zero or negative delays', () => {
      expect(CampaignAntiBanConfigSchema.safeParse({ delayMin: 0, delayMax: 30 }).success).toBe(
        false,
      )
      expect(CampaignAntiBanConfigSchema.safeParse({ delayMin: -5, delayMax: 30 }).success).toBe(
        false,
      )
      expect(CampaignAntiBanConfigSchema.safeParse({ delayMin: 10, delayMax: 0 }).success).toBe(
        false,
      )
    })
  })

  describe('CreateCampaignInputSchema', () => {
    it('should accept valid campaign input', () => {
      const input = {
        inboxId: validInboxId,
        title: 'Promo Diskon Akhir Tahun',
        messageContent: 'Halo Kak! Dapatkan diskon 30% untuk semua produk khusus hari ini.',
        scheduledAt: '2026-12-31T23:59:59.000Z',
        audience: {
          type: 'labels',
          labelIds: [validLabelId1],
        },
        antiBanDelayMin: 15,
        antiBanDelayMax: 45,
      }
      const res = CreateCampaignInputSchema.safeParse(input)
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.title).toBe('Promo Diskon Akhir Tahun')
        expect(res.data.antiBanDelayMin).toBe(15)
        expect(res.data.antiBanDelayMax).toBe(45)
      }
    })

    it('should apply default values for anti-ban delays', () => {
      const input = {
        inboxId: validInboxId,
        title: 'Pengumuman Maintenance Server',
        messageContent: 'Sistem akan maintenance selama 1 jam.',
        audience: {
          type: 'all_contacts',
        },
      }
      const res = CreateCampaignInputSchema.safeParse(input)
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.antiBanDelayMin).toBe(15)
        expect(res.data.antiBanDelayMax).toBe(45)
      }
    })

    it('should reject when required fields are missing', () => {
      expect(CreateCampaignInputSchema.safeParse({}).success).toBe(false)
      expect(
        CreateCampaignInputSchema.safeParse({
          inboxId: validInboxId,
          title: '',
          messageContent: 'Test',
          audience: { type: 'all_contacts' },
        }).success,
      ).toBe(false)
      expect(
        CreateCampaignInputSchema.safeParse({
          inboxId: validInboxId,
          title: 'Test',
          messageContent: '',
          audience: { type: 'all_contacts' },
        }).success,
      ).toBe(false)
      expect(
        CreateCampaignInputSchema.safeParse({
          inboxId: 'invalid-uuid',
          title: 'Test',
          messageContent: 'Test',
          audience: { type: 'all_contacts' },
        }).success,
      ).toBe(false)
    })

    it('should reject when antiBanDelayMin > antiBanDelayMax', () => {
      const res = CreateCampaignInputSchema.safeParse({
        inboxId: validInboxId,
        title: 'Valid Title',
        messageContent: 'Valid content',
        audience: { type: 'all_contacts' },
        antiBanDelayMin: 60,
        antiBanDelayMax: 30,
      })
      expect(res.success).toBe(false)
    })
  })

  describe('UpdateCampaignInputSchema', () => {
    it('should accept partial campaign update', () => {
      const res = UpdateCampaignInputSchema.safeParse({
        title: 'Updated Campaign Title',
        status: 'scheduled',
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.title).toBe('Updated Campaign Title')
        expect(res.data.status).toBe('scheduled')
      }
    })

    it('should reject invalid delay range in update', () => {
      const res = UpdateCampaignInputSchema.safeParse({
        antiBanDelayMin: 50,
        antiBanDelayMax: 20,
      })
      expect(res.success).toBe(false)
    })
  })

  describe('CampaignSchema', () => {
    it('should validate full campaign database model', () => {
      const campaign = {
        id: validCampaignId,
        inboxId: validInboxId,
        title: 'Broadcast Ramadan Sale',
        messageContent: 'Selamat menunaikan ibadah puasa!',
        scheduledAt: new Date().toISOString(),
        status: 'draft',
        antiBanDelayMin: 15,
        antiBanDelayMax: 45,
        audience: {
          type: 'labels',
          labelIds: [validLabelId1],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const res = CampaignSchema.safeParse(campaign)
      expect(res.success).toBe(true)
    })
  })

  describe('Campaign Delivery Schemas', () => {
    it('should validate CreateCampaignDeliveryInputSchema', () => {
      const deliveryInput = {
        campaignId: validCampaignId,
        contactId: validContactId1,
      }
      const res = CreateCampaignDeliveryInputSchema.safeParse(deliveryInput)
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.status).toBe('pending')
      }
    })

    it('should validate CampaignDeliverySchema', () => {
      const delivery = {
        id: '123e4567-e89b-12d3-a456-426614174099',
        campaignId: validCampaignId,
        contactId: validContactId1,
        status: 'sent',
        errorMessage: null,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const res = CampaignDeliverySchema.safeParse(delivery)
      expect(res.success).toBe(true)
    })

    it('should reject invalid UUIDs for delivery references', () => {
      expect(
        CreateCampaignDeliveryInputSchema.safeParse({
          campaignId: 'invalid-uuid',
          contactId: validContactId1,
        }).success,
      ).toBe(false)
      expect(
        CreateCampaignDeliveryInputSchema.safeParse({
          campaignId: validCampaignId,
          contactId: 'invalid-uuid',
        }).success,
      ).toBe(false)
    })
  })

  describe('Single Organization Rule Guardrail', () => {
    it('must NOT contain account_id or accountId in Campaign schemas', () => {
      const campaignKeys = Object.keys(CampaignSchema.shape)
      const inputKeys = Object.keys(CreateCampaignInputSchema.shape)
      const deliveryKeys = Object.keys(CampaignDeliverySchema.shape)
      const deliveryInputKeys = Object.keys(CreateCampaignDeliveryInputSchema.shape)

      expect(campaignKeys).not.toContain('account_id')
      expect(campaignKeys).not.toContain('accountId')
      expect(inputKeys).not.toContain('account_id')
      expect(inputKeys).not.toContain('accountId')
      expect(deliveryKeys).not.toContain('account_id')
      expect(deliveryKeys).not.toContain('accountId')
      expect(deliveryInputKeys).not.toContain('account_id')
      expect(deliveryInputKeys).not.toContain('accountId')
    })
  })

  describe('Phase 4 Checklist Synchronization', () => {
    it('should mark Task 4.8 as completed in docs/PHASE_4_CHECKLIST.md', () => {
      const checklistPath = join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md')
      const content = readFileSync(checklistPath, 'utf-8')
      expect(content).toContain(
        '- [x] **Task 4.8**: Skema validasi pengiriman Campaign & broadcast audience selector.',
      )
    })
  })
})
