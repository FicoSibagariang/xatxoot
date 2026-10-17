import { z } from 'zod'

// ==========================================
// Phase 2: Macros & WhatsApp Message Templates (Task 2.10)
// ==========================================

// 1. Macro & Macro Action Schemas
export const MacroVisibilitySchema = z.enum(['personal', 'global'])
export type MacroVisibility = z.infer<typeof MacroVisibilitySchema>

export const MacroActionTypeSchema = z.enum([
  'assign_team',
  'assign_agent',
  'change_status',
  'change_priority',
  'add_label',
  'remove_label',
  'send_message',
  'add_internal_note',
  'snooze_ticket',
])
export type MacroActionType = z.infer<typeof MacroActionTypeSchema>

export const MacroActionInputSchema = z.object({
  actionType: MacroActionTypeSchema,
  actionPayload: z.record(z.any()).default({}),
  position: z.number().int().nonnegative().default(0),
})
export type MacroActionInput = z.infer<typeof MacroActionInputSchema>

export const MacroActionSchema = z.object({
  id: z.string().uuid(),
  macroId: z.string().uuid(),
  actionType: MacroActionTypeSchema,
  actionPayload: z.record(z.any()),
  position: z.number().int().nonnegative(),
  createdAt: z.string().or(z.date()),
})
export type MacroAction = z.infer<typeof MacroActionSchema>

export const CreateMacroInputSchema = z.object({
  name: z.string().min(1, 'Nama makro wajib diisi').max(255),
  visibility: MacroVisibilitySchema.default('personal'),
  actions: z.array(MacroActionInputSchema).min(1, 'Minimal satu aksi makro diperlukan'),
})
export type CreateMacroInput = z.infer<typeof CreateMacroInputSchema>

export const UpdateMacroInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  visibility: MacroVisibilitySchema.optional(),
  actions: z.array(MacroActionInputSchema).optional(),
})
export type UpdateMacroInput = z.infer<typeof UpdateMacroInputSchema>

export const MacroSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  visibility: MacroVisibilitySchema,
  createdBy: z.string().uuid().nullable().optional(),
  actions: z.array(MacroActionSchema).default([]),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Macro = z.infer<typeof MacroSchema>

export const ExecuteMacroInputSchema = z.object({
  macroId: z.string().uuid('Macro ID harus berupa UUID valid'),
  ticketId: z.string().uuid('Ticket ID harus berupa UUID valid'),
  conversationId: z.string().uuid().optional(),
})
export type ExecuteMacroInput = z.infer<typeof ExecuteMacroInputSchema>

// 2. WhatsApp Message Template Schemas
export const WhatsAppTemplateCategorySchema = z.enum(['AUTHENTICATION', 'MARKETING', 'UTILITY'])
export type WhatsAppTemplateCategory = z.infer<typeof WhatsAppTemplateCategorySchema>

export const WhatsAppTemplateStatusSchema = z.enum([
  'APPROVED',
  'PENDING',
  'REJECTED',
  'PAUSED',
  'DISABLED',
])
export type WhatsAppTemplateStatus = z.infer<typeof WhatsAppTemplateStatusSchema>

export const WhatsAppTemplateComponentTypeSchema = z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS'])
export type WhatsAppTemplateComponentType = z.infer<typeof WhatsAppTemplateComponentTypeSchema>

export const WhatsAppTemplateHeaderFormatSchema = z.enum([
  'TEXT',
  'IMAGE',
  'VIDEO',
  'DOCUMENT',
  'LOCATION',
])
export type WhatsAppTemplateHeaderFormat = z.infer<typeof WhatsAppTemplateHeaderFormatSchema>

export const WhatsAppTemplateButtonTypeSchema = z.enum([
  'QUICK_REPLY',
  'URL',
  'PHONE_NUMBER',
  'COPY_CODE',
  'FLOW',
])
export type WhatsAppTemplateButtonType = z.infer<typeof WhatsAppTemplateButtonTypeSchema>

export const WhatsAppTemplateButtonSchema = z.object({
  type: WhatsAppTemplateButtonTypeSchema,
  text: z.string().min(1),
  url: z.string().url().optional(),
  phoneNumber: z.string().optional(),
  example: z.array(z.string()).optional(),
})
export type WhatsAppTemplateButton = z.infer<typeof WhatsAppTemplateButtonSchema>

export const WhatsAppTemplateComponentSchema = z.object({
  type: WhatsAppTemplateComponentTypeSchema,
  format: WhatsAppTemplateHeaderFormatSchema.optional(),
  text: z.string().optional(),
  example: z.record(z.any()).optional(),
  buttons: z.array(WhatsAppTemplateButtonSchema).optional(),
})
export type WhatsAppTemplateComponent = z.infer<typeof WhatsAppTemplateComponentSchema>

export const WhatsAppTemplateSchema = z.object({
  id: z.string().uuid(),
  wabaTemplateId: z.string().nullable().optional(),
  name: z.string().min(1),
  language: z.string().min(1).default('id'),
  category: WhatsAppTemplateCategorySchema,
  status: WhatsAppTemplateStatusSchema,
  components: z.array(WhatsAppTemplateComponentSchema),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type WhatsAppTemplate = z.infer<typeof WhatsAppTemplateSchema>

export const CreateWhatsAppTemplateInputSchema = z.object({
  wabaTemplateId: z.string().nullable().optional(),
  name: z.string().min(1, 'Nama template wajib diisi'),
  language: z.string().min(1).default('id'),
  category: WhatsAppTemplateCategorySchema,
  status: WhatsAppTemplateStatusSchema.default('APPROVED'),
  components: z.array(WhatsAppTemplateComponentSchema).min(1, 'Minimal satu komponen diperlukan'),
})
export type CreateWhatsAppTemplateInput = z.infer<typeof CreateWhatsAppTemplateInputSchema>

export const UpdateWhatsAppTemplateInputSchema = CreateWhatsAppTemplateInputSchema.partial()
export type UpdateWhatsAppTemplateInput = z.infer<typeof UpdateWhatsAppTemplateInputSchema>

// 3. WhatsApp Message Template Outbound Dynamic Parameters
export const WhatsAppTemplateParameterTypeSchema = z.enum([
  'text',
  'currency',
  'date_time',
  'image',
  'document',
  'video',
  'payload',
])
export type WhatsAppTemplateParameterType = z.infer<typeof WhatsAppTemplateParameterTypeSchema>

export const WhatsAppTemplateParameterMediaSchema = z.object({
  link: z.string().url('Link media harus berupa URL valid'),
  filename: z.string().optional(),
})
export type WhatsAppTemplateParameterMedia = z.infer<typeof WhatsAppTemplateParameterMediaSchema>

export const WhatsAppTemplateParameterCurrencySchema = z.object({
  fallbackValue: z.string().min(1),
  code: z.string().min(1),
  amount1000: z.number().int(),
})
export type WhatsAppTemplateParameterCurrency = z.infer<
  typeof WhatsAppTemplateParameterCurrencySchema
>

export const WhatsAppTemplateParameterDateTimeSchema = z.object({
  fallbackValue: z.string().min(1),
})
export type WhatsAppTemplateParameterDateTime = z.infer<
  typeof WhatsAppTemplateParameterDateTimeSchema
>

export const WhatsAppTemplateParameterSchema = z.object({
  type: WhatsAppTemplateParameterTypeSchema,
  text: z.string().optional(),
  currency: WhatsAppTemplateParameterCurrencySchema.optional(),
  dateTime: WhatsAppTemplateParameterDateTimeSchema.optional(),
  image: WhatsAppTemplateParameterMediaSchema.optional(),
  document: WhatsAppTemplateParameterMediaSchema.optional(),
  video: WhatsAppTemplateParameterMediaSchema.optional(),
  payload: z.string().optional(),
})
export type WhatsAppTemplateParameter = z.infer<typeof WhatsAppTemplateParameterSchema>

export const WhatsAppTemplateMessageComponentSchema = z.object({
  type: z.enum(['header', 'body', 'button']),
  subType: z.enum(['quick_reply', 'url']).optional(),
  index: z.number().int().nonnegative().optional(),
  parameters: z.array(WhatsAppTemplateParameterSchema).default([]),
})
export type WhatsAppTemplateMessageComponent = z.infer<
  typeof WhatsAppTemplateMessageComponentSchema
>

export const SendWhatsAppTemplateMessageInputSchema = z.object({
  conversationId: z.string().uuid('Conversation ID harus berupa UUID valid'),
  templateName: z.string().min(1, 'Nama template wajib diisi'),
  languageCode: z.string().default('id'),
  components: z.array(WhatsAppTemplateMessageComponentSchema).default([]),
})
export type SendWhatsAppTemplateMessageInput = z.infer<
  typeof SendWhatsAppTemplateMessageInputSchema
>
