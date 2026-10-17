import { z } from 'zod'
import { TicketPrioritySchema } from './tickets'

// ==========================================
// Phase 5: SLA Policy & Priority Rules (Task 5.7)
// ==========================================

export const SlaPriorityRuleSchema = z
  .object({
    priority: TicketPrioritySchema,
    firstResponseTimeSeconds: z.number().int().positive('Waktu respons pertama minimal 1 detik'),
    resolutionTimeSeconds: z.number().int().positive('Waktu resolusi minimal 1 detik'),
  })
  .superRefine((data, ctx) => {
    if (data.firstResponseTimeSeconds > data.resolutionTimeSeconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'firstResponseTimeSeconds tidak boleh melebihi resolutionTimeSeconds',
        path: ['firstResponseTimeSeconds'],
      })
    }
  })
export type SlaPriorityRule = z.infer<typeof SlaPriorityRuleSchema>

export const CreateSlaPolicyInputSchema = z
  .object({
    name: z.string().min(1, 'Nama SLA policy wajib diisi').max(255),
    description: z.string().optional(),
    inboxId: z.string().uuid('inboxId harus berupa UUID valid').nullable().optional(),
    firstResponseTimeSeconds: z
      .number()
      .int()
      .positive('Waktu respons pertama minimal 1 detik')
      .default(3600),
    resolutionTimeSeconds: z
      .number()
      .int()
      .positive('Waktu resolusi minimal 1 detik')
      .default(86400),
    priorityRules: z.array(SlaPriorityRuleSchema).optional(),
    onlyDuringBusinessHours: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.firstResponseTimeSeconds > data.resolutionTimeSeconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'firstResponseTimeSeconds tidak boleh melebihi resolutionTimeSeconds',
        path: ['firstResponseTimeSeconds'],
      })
    }
  })
export type CreateSlaPolicyInput = z.infer<typeof CreateSlaPolicyInputSchema>

export const UpdateSlaPolicyInputSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    inboxId: z.string().uuid('inboxId harus berupa UUID valid').nullable().optional(),
    firstResponseTimeSeconds: z
      .number()
      .int()
      .positive('Waktu respons pertama minimal 1 detik')
      .optional(),
    resolutionTimeSeconds: z.number().int().positive('Waktu resolusi minimal 1 detik').optional(),
    priorityRules: z.array(SlaPriorityRuleSchema).optional(),
    onlyDuringBusinessHours: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.firstResponseTimeSeconds !== undefined &&
      data.resolutionTimeSeconds !== undefined &&
      data.firstResponseTimeSeconds > data.resolutionTimeSeconds
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'firstResponseTimeSeconds tidak boleh melebihi resolutionTimeSeconds',
        path: ['firstResponseTimeSeconds'],
      })
    }
  })
export type UpdateSlaPolicyInput = z.infer<typeof UpdateSlaPolicyInputSchema>

export const SlaPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  inboxId: z.string().uuid().nullable().optional(),
  firstResponseTimeSeconds: z.number().int(),
  resolutionTimeSeconds: z.number().int(),
  priorityRules: z.array(SlaPriorityRuleSchema).optional(),
  onlyDuringBusinessHours: z.boolean().default(false),
  active: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type SlaPolicy = z.infer<typeof SlaPolicySchema>

export const TicketSlaStatusSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  policyId: z.string().uuid().nullable().optional(),
  firstResponseDeadline: z.string().or(z.date()).nullable().optional(),
  resolutionDeadline: z.string().or(z.date()).nullable().optional(),
  isBreached: z.boolean().default(false),
  breachedAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type TicketSlaStatus = z.infer<typeof TicketSlaStatusSchema>

export const CalculateSlaDeadlinesInputSchema = z.object({
  ticketId: z.string().uuid('ticketId harus berupa UUID valid'),
  policyId: z.string().uuid('policyId harus berupa UUID valid'),
  priority: TicketPrioritySchema,
  openedAt: z.string().datetime().or(z.date()).optional(),
})
export type CalculateSlaDeadlinesInput = z.infer<typeof CalculateSlaDeadlinesInputSchema>
