import { z } from 'zod'

// ==========================================
// Phase 4: Automation Rules Engine DSL (Task 4.7)
// ==========================================

export const AutomationRuleEventSchema = z.enum([
  'conversation_created',
  'conversation_updated',
  'conversation_opened',
  'conversation_resolved',
  'message_created',
])
export type AutomationRuleEvent = z.infer<typeof AutomationRuleEventSchema>

export const AutomationRuleOperatorSchema = z.enum([
  'equal_to',
  'not_equal_to',
  'contains',
  'does_not_contain',
  'starts_with',
  'ends_with',
  'is_present',
  'is_not_present',
  'in_list',
])
export type AutomationRuleOperator = z.infer<typeof AutomationRuleOperatorSchema>

export const AutomationRuleConditionSchema = z.object({
  attribute: z.string().min(1, 'Attribute kondisi wajib diisi'),
  operator: AutomationRuleOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
})
export type AutomationRuleCondition = z.infer<typeof AutomationRuleConditionSchema>

export const AutomationRuleActionTypeSchema = z.enum([
  'send_message',
  'add_label',
  'remove_label',
  'assign_team',
  'assign_agent',
  'remove_assigned_agent',
  'remove_assigned_team',
  'change_status',
  'change_priority',
  'add_internal_note',
  'send_webhook_event',
  'mute_conversation',
])
export type AutomationRuleActionType = z.infer<typeof AutomationRuleActionTypeSchema>

export const AutomationRuleActionSchema = z.object({
  actionName: AutomationRuleActionTypeSchema,
  actionParams: z.record(z.any()).optional(),
})
export type AutomationRuleAction = z.infer<typeof AutomationRuleActionSchema>

export const CreateAutomationRuleInputSchema = z.object({
  name: z.string().min(1, 'Nama aturan otomasi wajib diisi').max(255),
  eventName: AutomationRuleEventSchema,
  conditions: z
    .array(AutomationRuleConditionSchema)
    .min(1, 'Aturan wajib memiliki minimal 1 kondisi'),
  actions: z.array(AutomationRuleActionSchema).min(1, 'Aturan wajib memiliki minimal 1 aksi'),
  active: z.boolean().default(true),
})
export type CreateAutomationRuleInput = z.infer<typeof CreateAutomationRuleInputSchema>

export const UpdateAutomationRuleInputSchema = CreateAutomationRuleInputSchema.partial()
export type UpdateAutomationRuleInput = z.infer<typeof UpdateAutomationRuleInputSchema>

export const AutomationRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  eventName: AutomationRuleEventSchema,
  conditions: z.array(AutomationRuleConditionSchema),
  actions: z.array(AutomationRuleActionSchema),
  active: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type AutomationRule = z.infer<typeof AutomationRuleSchema>

// ==========================================
// Phase 4: Campaigns & Broadcast Audience Schemas (Task 4.8)
// ==========================================

export const CampaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'processing',
  'completed',
  'cancelled',
  'failed',
])
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>

export const CampaignDeliveryStatusSchema = z.enum(['pending', 'sent', 'failed'])
export type CampaignDeliveryStatus = z.infer<typeof CampaignDeliveryStatusSchema>

export const CampaignAudienceTypeSchema = z.enum(['all_contacts', 'labels', 'custom_list'])
export type CampaignAudienceType = z.infer<typeof CampaignAudienceTypeSchema>

export const CampaignAudienceSelectorSchema = z
  .object({
    type: CampaignAudienceTypeSchema,
    labelIds: z.array(z.string().uuid('labelId harus berupa UUID valid')).optional(),
    contactIds: z.array(z.string().uuid('contactId harus berupa UUID valid')).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'labels') {
      if (!data.labelIds || data.labelIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'labelIds wajib diisi minimal 1 ketika tipe audience labels',
          path: ['labelIds'],
        })
      }
    } else if (data.type === 'custom_list') {
      if (!data.contactIds || data.contactIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'contactIds wajib diisi minimal 1 ketika tipe audience custom_list',
          path: ['contactIds'],
        })
      }
    }
  })
export type CampaignAudienceSelector = z.infer<typeof CampaignAudienceSelectorSchema>

export const CampaignAntiBanConfigSchema = z
  .object({
    delayMin: z.number().int().min(1, 'Jeda minimum minimal 1 detik').default(15),
    delayMax: z.number().int().min(1, 'Jeda maksimum minimal 1 detik').default(45),
    batchSize: z.number().int().positive().default(50),
    randomizeJitter: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.delayMin > data.delayMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'delayMin tidak boleh lebih besar dari delayMax',
        path: ['delayMin'],
      })
    }
  })
export type CampaignAntiBanConfig = z.infer<typeof CampaignAntiBanConfigSchema>

export const CreateCampaignInputSchema = z
  .object({
    inboxId: z.string().uuid('inboxId harus berupa UUID valid'),
    title: z.string().min(1, 'Judul kampanye wajib diisi').max(255),
    messageContent: z.string().min(1, 'Isi pesan kampanye wajib diisi'),
    scheduledAt: z.string().datetime().or(z.date()).nullable().optional(),
    audience: CampaignAudienceSelectorSchema,
    antiBanDelayMin: z.number().int().min(1).default(15),
    antiBanDelayMax: z.number().int().min(1).default(45),
  })
  .superRefine((data, ctx) => {
    if (data.antiBanDelayMin > data.antiBanDelayMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'antiBanDelayMin tidak boleh lebih besar dari antiBanDelayMax',
        path: ['antiBanDelayMin'],
      })
    }
  })
export type CreateCampaignInput = z.infer<typeof CreateCampaignInputSchema>

export const UpdateCampaignInputSchema = z
  .object({
    inboxId: z.string().uuid('inboxId harus berupa UUID valid').optional(),
    title: z.string().min(1).max(255).optional(),
    messageContent: z.string().min(1).optional(),
    scheduledAt: z.string().datetime().or(z.date()).nullable().optional(),
    status: CampaignStatusSchema.optional(),
    audience: CampaignAudienceSelectorSchema.optional(),
    antiBanDelayMin: z.number().int().min(1).optional(),
    antiBanDelayMax: z.number().int().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.antiBanDelayMin !== undefined &&
      data.antiBanDelayMax !== undefined &&
      data.antiBanDelayMin > data.antiBanDelayMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'antiBanDelayMin tidak boleh lebih besar dari antiBanDelayMax',
        path: ['antiBanDelayMin'],
      })
    }
  })
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignInputSchema>

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  inboxId: z.string().uuid(),
  title: z.string(),
  messageContent: z.string(),
  scheduledAt: z.string().or(z.date()).nullable().optional(),
  status: CampaignStatusSchema,
  antiBanDelayMin: z.number().int().default(15),
  antiBanDelayMax: z.number().int().default(45),
  audience: CampaignAudienceSelectorSchema.optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Campaign = z.infer<typeof CampaignSchema>

export const CreateCampaignDeliveryInputSchema = z.object({
  campaignId: z.string().uuid('campaignId harus berupa UUID valid'),
  contactId: z.string().uuid('contactId harus berupa UUID valid'),
  status: CampaignDeliveryStatusSchema.default('pending'),
  errorMessage: z.string().nullable().optional(),
  sentAt: z.string().datetime().or(z.date()).nullable().optional(),
})
export type CreateCampaignDeliveryInput = z.infer<typeof CreateCampaignDeliveryInputSchema>

export const CampaignDeliverySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  contactId: z.string().uuid(),
  status: CampaignDeliveryStatusSchema,
  errorMessage: z.string().nullable().optional(),
  sentAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type CampaignDelivery = z.infer<typeof CampaignDeliverySchema>
