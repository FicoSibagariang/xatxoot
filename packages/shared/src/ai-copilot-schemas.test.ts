import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AiChangeToneRequestSchema,
  AiCopilotActionRequestSchema,
  AiCopilotActionResponseSchema,
  AiCopilotActionTypeSchema,
  AiDraftReplyRequestSchema,
  AiImproveWritingRequestSchema,
  AiProviderTypeSchema,
  AiSettingSchema,
  AiSummarizeRequestSchema,
  AiToneTypeSchema,
  CreateAiSettingInputSchema,
  UpdateAiSettingInputSchema,
} from './schemas'

describe('AI Provider & Copilot Action Request Schemas (Task 5.6 - packages/shared)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..')
  const validUuid = '123e4567-e89b-12d3-a456-426614174000'

  describe('1. AiProviderTypeSchema', () => {
    it('should accept valid AI providers', () => {
      const providers = ['openai', 'gemini', 'anthropic', 'ollama']
      for (const provider of providers) {
        const result = AiProviderTypeSchema.safeParse(provider)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid AI providers', () => {
      expect(AiProviderTypeSchema.safeParse('invalid_llm').success).toBe(false)
      expect(AiProviderTypeSchema.safeParse('').success).toBe(false)
      expect(AiProviderTypeSchema.safeParse(123).success).toBe(false)
    })
  })

  describe('2. CreateAiSettingInputSchema & UpdateAiSettingInputSchema', () => {
    it('should validate valid cloud AI provider configuration with apiKey', () => {
      const validOpenAi = {
        provider: 'openai',
        apiKey: 'sk-proj-test1234567890',
        modelName: 'gpt-4o',
        temperature: 0.7,
        active: true,
      }
      const result = CreateAiSettingInputSchema.safeParse(validOpenAi)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('openai')
        expect(result.data.modelName).toBe('gpt-4o')
        expect(result.data.temperature).toBe(0.7)
      }
    })

    it('should validate local Ollama provider without requiring apiKey', () => {
      const validOllama = {
        provider: 'ollama',
        modelName: 'llama3:8b',
        baseUrl: 'http://localhost:11434',
        temperature: 0.5,
        active: true,
      }
      const result = CreateAiSettingInputSchema.safeParse(validOllama)
      expect(result.success).toBe(true)
    })

    it('should require apiKey for cloud providers (openai, gemini, anthropic)', () => {
      const missingKey = {
        provider: 'openai',
        modelName: 'gpt-4o',
      }
      const result = CreateAiSettingInputSchema.safeParse(missingKey)
      expect(result.success).toBe(false)
    })

    it('should reject temperature out of range [0, 2]', () => {
      const tooHigh = {
        provider: 'gemini',
        apiKey: 'AIzaSyTest123',
        modelName: 'gemini-1.5-pro',
        temperature: 2.5,
      }
      expect(CreateAiSettingInputSchema.safeParse(tooHigh).success).toBe(false)

      const tooLow = {
        provider: 'gemini',
        apiKey: 'AIzaSyTest123',
        modelName: 'gemini-1.5-pro',
        temperature: -0.1,
      }
      expect(CreateAiSettingInputSchema.safeParse(tooLow).success).toBe(false)
    })

    it('should validate partial update input', () => {
      const update = {
        temperature: 0.3,
        active: false,
      }
      const result = UpdateAiSettingInputSchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })

  describe('3. AiSettingSchema (Persisted Entity)', () => {
    it('should validate full persisted AI setting entity', () => {
      const setting = {
        id: validUuid,
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet-20241022',
        temperature: 0.6,
        active: true,
        apiKeyEncrypted: 'enc_secret_key_123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const result = AiSettingSchema.safeParse(setting)
      expect(result.success).toBe(true)
    })
  })

  describe('4. AiToneTypeSchema & AiCopilotActionTypeSchema', () => {
    it('should accept supported tone types', () => {
      const tones = ['polite', 'formal', 'concise', 'friendly']
      for (const tone of tones) {
        expect(AiToneTypeSchema.safeParse(tone).success).toBe(true)
      }
    })

    it('should accept supported copilot action types', () => {
      const actions = ['summarize', 'change_tone', 'improve_writing', 'draft_reply']
      for (const action of actions) {
        expect(AiCopilotActionTypeSchema.safeParse(action).success).toBe(true)
      }
    })

    it('should reject invalid tone and action types', () => {
      expect(AiToneTypeSchema.safeParse('aggressive').success).toBe(false)
      expect(AiCopilotActionTypeSchema.safeParse('translate_audio').success).toBe(false)
    })
  })

  describe('5. Copilot Specific Action Request Schemas', () => {
    it('should validate AiSummarizeRequestSchema', () => {
      const req = {
        conversationId: validUuid,
        maxLength: 300,
      }
      const result = AiSummarizeRequestSchema.safeParse(req)
      expect(result.success).toBe(true)
    })

    it('should validate AiChangeToneRequestSchema', () => {
      const req = {
        text: 'Halo kak, barangnya ready ya silakan order.',
        tone: 'formal',
        language: 'id',
      }
      const result = AiChangeToneRequestSchema.safeParse(req)
      expect(result.success).toBe(true)
    })

    it('should validate AiImproveWritingRequestSchema', () => {
      const req = {
        text: 'saya mau tanya tntang pesanan yg kmaren belum dtg',
        language: 'id',
      }
      const result = AiImproveWritingRequestSchema.safeParse(req)
      expect(result.success).toBe(true)
    })

    it('should validate AiDraftReplyRequestSchema', () => {
      const req = {
        conversationId: validUuid,
        customerQuery: 'Bagaimana cara melakukan refund untuk produk rusak?',
        relevantArticles: ['Kebijakan Garansi & Pengembalian Dana'],
        tone: 'polite',
      }
      const result = AiDraftReplyRequestSchema.safeParse(req)
      expect(result.success).toBe(true)
    })
  })

  describe('6. AiCopilotActionRequestSchema & AiCopilotActionResponseSchema', () => {
    it('should validate generic copilot action request for summarize', () => {
      const req = {
        action: 'summarize',
        conversationId: validUuid,
      }
      const result = AiCopilotActionRequestSchema.safeParse(req)
      expect(result.success).toBe(true)
    })

    it('should validate generic copilot action request for change_tone', () => {
      const req = {
        action: 'change_tone',
        text: 'halo kawan, tolong kirim invoice',
        tone: 'formal',
      }
      const result = AiCopilotActionRequestSchema.safeParse(req)
      expect(result.success).toBe(true)
    })

    it('should validate generic copilot action request for draft_reply', () => {
      const req = {
        action: 'draft_reply',
        conversationId: validUuid,
        customerQuery: 'Berapa biaya ongkir ke Jakarta?',
      }
      const result = AiCopilotActionRequestSchema.safeParse(req)
      expect(result.success).toBe(true)
    })

    it('should validate copilot response schema', () => {
      const res = {
        action: 'draft_reply',
        result: 'Halo Kak! Untuk biaya ongkir ke area Jakarta mulai dari Rp 10.000.',
        suggestedArticles: [
          {
            title: 'Tarif Pengiriman Domestik',
            url: 'https://help.xatxoot.com/articles/shipping-rates',
          },
        ],
        usage: {
          promptTokens: 120,
          completionTokens: 35,
          totalTokens: 155,
        },
      }
      const result = AiCopilotActionResponseSchema.safeParse(res)
      expect(result.success).toBe(true)
    })
  })

  describe('7. Single Organization Guardrail (No account_id)', () => {
    it('should strictly NOT contain account_id or accountId in AI provider or Copilot schemas', () => {
      const createShape = CreateAiSettingInputSchema.shape as Record<string, unknown>
      const settingShape = AiSettingSchema.shape as Record<string, unknown>
      const reqShape = AiCopilotActionRequestSchema.shape as Record<string, unknown>

      expect(createShape.accountId).toBeUndefined()
      expect(createShape.account_id).toBeUndefined()
      expect(settingShape.accountId).toBeUndefined()
      expect(settingShape.account_id).toBeUndefined()
      expect(reqShape.accountId).toBeUndefined()
      expect(reqShape.account_id).toBeUndefined()
    })
  })

  describe('8. Phase 5 Checklist Verification', () => {
    it('should verify Phase 5 checklist marks Task 5.6 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 5.6**: Tipe & skema validasi konfigurasi AI Provider & Copilot action requests.',
      )
    })
  })
})
