import { z } from 'zod'

// ==========================================
// Phase 5: AI Provider & Copilot Schemas (Task 5.6)
// ==========================================

export const AiProviderTypeSchema = z.enum(['openai', 'gemini', 'anthropic', 'ollama'])
export type AiProviderType = z.infer<typeof AiProviderTypeSchema>

export const CreateAiSettingInputSchema = z
  .object({
    provider: AiProviderTypeSchema,
    apiKey: z.string().min(1, 'API key wajib diisi').optional(),
    modelName: z.string().min(1, 'Model name wajib diisi').max(100),
    baseUrl: z.string().url('Base URL harus berupa format URL valid').optional(),
    temperature: z
      .number()
      .min(0, 'Temperature minimal 0.0')
      .max(2, 'Temperature maksimal 2.0')
      .default(0.7),
    active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.provider !== 'ollama' && (!data.apiKey || data.apiKey.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `API key wajib diisi untuk provider ${data.provider}`,
        path: ['apiKey'],
      })
    }
  })
export type CreateAiSettingInput = z.infer<typeof CreateAiSettingInputSchema>

export const UpdateAiSettingInputSchema = z.object({
  provider: AiProviderTypeSchema.optional(),
  apiKey: z.string().min(1).optional(),
  modelName: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional(),
  temperature: z
    .number()
    .min(0, 'Temperature minimal 0.0')
    .max(2, 'Temperature maksimal 2.0')
    .optional(),
  active: z.boolean().optional(),
})
export type UpdateAiSettingInput = z.infer<typeof UpdateAiSettingInputSchema>

export const AiSettingSchema = z.object({
  id: z.string().uuid(),
  provider: AiProviderTypeSchema,
  modelName: z.string(),
  temperature: z.number(),
  active: z.boolean(),
  apiKeyEncrypted: z.string().nullable().optional(),
  apiKeyEnc: z.string().nullable().optional(),
  baseUrl: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type AiSetting = z.infer<typeof AiSettingSchema>

export const AiToneTypeSchema = z.enum(['polite', 'formal', 'concise', 'friendly'])
export type AiToneType = z.infer<typeof AiToneTypeSchema>

export const AiCopilotActionTypeSchema = z.enum([
  'summarize',
  'change_tone',
  'improve_writing',
  'draft_reply',
])
export type AiCopilotActionType = z.infer<typeof AiCopilotActionTypeSchema>

export const AiSummarizeRequestSchema = z.object({
  conversationId: z.string().uuid('conversationId harus berupa UUID valid'),
  messages: z
    .array(
      z.object({
        senderType: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
  maxLength: z.number().int().positive().optional(),
})
export type AiSummarizeRequest = z.infer<typeof AiSummarizeRequestSchema>

export const AiChangeToneRequestSchema = z.object({
  text: z.string().min(1, 'Teks wajib diisi'),
  tone: AiToneTypeSchema,
  language: z.string().default('id'),
})
export type AiChangeToneRequest = z.infer<typeof AiChangeToneRequestSchema>

export const AiImproveWritingRequestSchema = z.object({
  text: z.string().min(1, 'Teks wajib diisi'),
  language: z.string().default('id'),
})
export type AiImproveWritingRequest = z.infer<typeof AiImproveWritingRequestSchema>

export const AiDraftReplyRequestSchema = z.object({
  conversationId: z.string().uuid('conversationId harus berupa UUID valid').optional(),
  customerQuery: z.string().min(1, 'Pertanyaan pelanggan wajib diisi'),
  relevantArticles: z.array(z.string()).optional(),
  tone: AiToneTypeSchema.optional(),
})
export type AiDraftReplyRequest = z.infer<typeof AiDraftReplyRequestSchema>

export const AiCopilotActionRequestSchema = z.object({
  action: AiCopilotActionTypeSchema,
  conversationId: z.string().uuid('conversationId harus berupa UUID valid').optional(),
  text: z.string().optional(),
  tone: AiToneTypeSchema.optional(),
  customerQuery: z.string().optional(),
  relevantArticles: z.array(z.string()).optional(),
  language: z.string().default('id'),
})
export type AiCopilotActionRequest = z.infer<typeof AiCopilotActionRequestSchema>

export const AiCopilotActionResponseSchema = z.object({
  action: AiCopilotActionTypeSchema,
  result: z.string(),
  suggestedArticles: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string(),
        url: z.string().optional(),
      }),
    )
    .optional(),
  usage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
})
export type AiCopilotActionResponse = z.infer<typeof AiCopilotActionResponseSchema>
