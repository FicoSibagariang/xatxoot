import { describe, expect, it } from 'bun:test'
import {
  CreateMacroInputSchema,
  CreateWhatsAppTemplateInputSchema,
  ExecuteMacroInputSchema,
  type Macro,
  MacroActionInputSchema,
  MacroActionSchema,
  MacroActionTypeSchema,
  MacroSchema,
  MacroVisibilitySchema,
  SendWhatsAppTemplateMessageInputSchema,
  UpdateMacroInputSchema,
  UpdateWhatsAppTemplateInputSchema,
  type WhatsAppTemplate,
  WhatsAppTemplateCategorySchema,
  WhatsAppTemplateComponentSchema,
  WhatsAppTemplateMessageComponentSchema,
  WhatsAppTemplateParameterSchema,
  WhatsAppTemplateSchema,
  WhatsAppTemplateStatusSchema,
} from './index'

describe('Macro & WhatsApp Message Template Validation Schemas (Phase 2 - Task 2.10)', () => {
  describe('Macro and Macro Action Schemas', () => {
    it('should validate allowed Macro visibility values', () => {
      expect(MacroVisibilitySchema.safeParse('personal').success).toBe(true)
      expect(MacroVisibilitySchema.safeParse('global').success).toBe(true)
      expect(MacroVisibilitySchema.safeParse('unsupported').success).toBe(false)
    })

    it('should validate allowed Macro action types', () => {
      const allowed = [
        'assign_team',
        'assign_agent',
        'change_status',
        'change_priority',
        'add_label',
        'remove_label',
        'send_message',
        'add_internal_note',
        'snooze_ticket',
      ]

      for (const action of allowed) {
        expect(MacroActionTypeSchema.safeParse(action).success).toBe(true)
      }
      expect(MacroActionTypeSchema.safeParse('invalid_action').success).toBe(false)
    })

    it('should validate CreateMacroInputSchema with multi-action list', () => {
      const input = {
        name: 'Selesaikan & Beri Label Billing',
        visibility: 'global',
        actions: [
          {
            actionType: 'change_status',
            actionPayload: { status: 'resolved' },
            position: 0,
          },
          {
            actionType: 'add_label',
            actionPayload: { labelName: 'billing-resolved' },
            position: 1,
          },
          {
            actionType: 'assign_team',
            actionPayload: { teamId: '123e4567-e89b-12d3-a456-426614174000' },
            position: 2,
          },
        ],
      }

      const result = CreateMacroInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Selesaikan & Beri Label Billing')
        expect(result.data.actions).toHaveLength(3)
      }
    })

    it('should reject CreateMacroInputSchema with empty name or empty actions', () => {
      expect(
        CreateMacroInputSchema.safeParse({
          name: '',
          actions: [{ actionType: 'change_status', actionPayload: {} }],
        }).success,
      ).toBe(false)

      expect(
        CreateMacroInputSchema.safeParse({
          name: 'Macro Tanpa Aksi',
          actions: [],
        }).success,
      ).toBe(false)
    })

    it('should validate UpdateMacroInputSchema as partial', () => {
      const result = UpdateMacroInputSchema.safeParse({
        name: 'Nama Makro Diperbarui',
      })
      expect(result.success).toBe(true)
    })

    it('should validate complete Macro and MacroAction entities', () => {
      const fullMacro: Macro = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Escalate to L2',
        visibility: 'personal',
        createdBy: '123e4567-e89b-12d3-a456-426614174002',
        actions: [
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            macroId: '123e4567-e89b-12d3-a456-426614174001',
            actionType: 'change_priority',
            actionPayload: { priority: 'urgent' },
            position: 0,
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(MacroSchema.safeParse(fullMacro).success).toBe(true)
      expect(MacroActionSchema.safeParse(fullMacro.actions[0]).success).toBe(true)
    })

    it('should validate ExecuteMacroInputSchema', () => {
      const exec = {
        macroId: '123e4567-e89b-12d3-a456-426614174001',
        ticketId: '123e4567-e89b-12d3-a456-426614174004',
        conversationId: '123e4567-e89b-12d3-a456-426614174005',
      }

      const result = ExecuteMacroInputSchema.safeParse(exec)
      expect(result.success).toBe(true)
    })
  })

  describe('WhatsApp Message Template Schemas', () => {
    it('should validate Category and Status enums', () => {
      expect(WhatsAppTemplateCategorySchema.safeParse('MARKETING').success).toBe(true)
      expect(WhatsAppTemplateCategorySchema.safeParse('UTILITY').success).toBe(true)
      expect(WhatsAppTemplateCategorySchema.safeParse('AUTHENTICATION').success).toBe(true)
      expect(WhatsAppTemplateCategorySchema.safeParse('INVALID').success).toBe(false)

      expect(WhatsAppTemplateStatusSchema.safeParse('APPROVED').success).toBe(true)
      expect(WhatsAppTemplateStatusSchema.safeParse('PENDING').success).toBe(true)
      expect(WhatsAppTemplateStatusSchema.safeParse('REJECTED').success).toBe(true)
      expect(WhatsAppTemplateStatusSchema.safeParse('INVALID').success).toBe(false)
    })

    it('should validate WhatsAppTemplateComponentSchema (Header, Body, Buttons)', () => {
      const components = [
        {
          type: 'HEADER',
          format: 'TEXT',
          text: 'Pemberitahuan Pesanan #{{1}}',
        },
        {
          type: 'BODY',
          text: 'Halo {{1}}, pesanan Anda dengan nomor resi {{2}} telah berhasil dikirimkan.',
          example: {
            body_text: [['Budi', 'JP123456789']],
          },
        },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'QUICK_REPLY',
              text: 'Lacak Pesanan',
            },
            {
              type: 'URL',
              text: 'Kunjungi Website',
              url: 'https://example.com/orders',
            },
          ],
        },
      ]

      for (const comp of components) {
        expect(WhatsAppTemplateComponentSchema.safeParse(comp).success).toBe(true)
      }
    })

    it('should validate CreateWhatsAppTemplateInputSchema and WhatsAppTemplateSchema', () => {
      const templateInput = {
        wabaTemplateId: 'meta_template_12345',
        name: 'shipping_update_v1',
        language: 'id',
        category: 'UTILITY',
        status: 'APPROVED',
        components: [
          {
            type: 'BODY',
            text: 'Paket Anda sedang diantar kurir ke alamat tujuan.',
          },
        ],
      }

      const inputResult = CreateWhatsAppTemplateInputSchema.safeParse(templateInput)
      expect(inputResult.success).toBe(true)

      const fullTemplate: WhatsAppTemplate = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        wabaTemplateId: templateInput.wabaTemplateId,
        name: templateInput.name,
        language: templateInput.language,
        category: 'UTILITY',
        status: 'APPROVED',
        components: templateInput.components,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(WhatsAppTemplateSchema.safeParse(fullTemplate).success).toBe(true)
      expect(UpdateWhatsAppTemplateInputSchema.safeParse({ status: 'REJECTED' }).success).toBe(true)
    })
  })

  describe('WhatsApp Message Template Dynamic Parameters (Outbound Delivery)', () => {
    it('should validate WhatsAppTemplateParameterSchema for text and media parameters', () => {
      const textParam = {
        type: 'text',
        text: 'Budi Santoso',
      }
      expect(WhatsAppTemplateParameterSchema.safeParse(textParam).success).toBe(true)

      const imageParam = {
        type: 'image',
        image: {
          link: 'https://example.com/receipt.jpg',
        },
      }
      expect(WhatsAppTemplateParameterSchema.safeParse(imageParam).success).toBe(true)

      const currencyParam = {
        type: 'currency',
        currency: {
          fallbackValue: 'Rp 150.000',
          code: 'IDR',
          amount1000: 150000000,
        },
      }
      expect(WhatsAppTemplateParameterSchema.safeParse(currencyParam).success).toBe(true)
    })

    it('should validate SendWhatsAppTemplateMessageInputSchema', () => {
      const sendInput = {
        conversationId: '123e4567-e89b-12d3-a456-426614174010',
        templateName: 'order_receipt',
        languageCode: 'id',
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: { link: 'https://example.com/header.png' },
              },
            ],
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Budi' },
              { type: 'text', text: 'ORD-9988' },
            ],
          },
          {
            type: 'button',
            subType: 'quick_reply',
            index: 0,
            parameters: [{ type: 'payload', payload: 'CONFIRM_RECEIPT' }],
          },
        ],
      }

      const result = SendWhatsAppTemplateMessageInputSchema.safeParse(sendInput)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.templateName).toBe('order_receipt')
        expect(result.data.components).toHaveLength(3)
      }
    })
  })

  describe('Single Organization & Ubiquitous Language Integrity', () => {
    it('should NOT accept or require account_id in any macro or template schema', () => {
      const sample = {
        name: 'Global Macro',
        account_id: 'forbidden_tenant',
        actions: [{ actionType: 'change_status', actionPayload: {} }],
      }
      const parsed = CreateMacroInputSchema.safeParse(sample)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect((parsed.data as Record<string, unknown>).account_id).toBeUndefined()
      }
    })

    it('should verify Phase 2 checklist marks Task 2.10 as completed', () => {
      const checklistPath = new URL('../../../docs/PHASE_2_CHECKLIST.md', import.meta.url).pathname
      const fs = require('node:fs')
      const checklistContent = fs.readFileSync(checklistPath, 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 2.10**: Skema validasi untuk Macro dan WhatsApp Message Template parameters.',
      )
    })
  })
})
