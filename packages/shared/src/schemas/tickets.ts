import { z } from 'zod'
import { UserAvailabilitySchema } from './auth'

// ==========================================
// Phase 1: Ticket Lifecycle & Transitions
// ==========================================

export const TicketStatusSchema = z.enum(['open', 'pending', 'snoozed', 'resolved'])
export type TicketStatus = z.infer<typeof TicketStatusSchema>

export const TicketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])
export type TicketPriority = z.infer<typeof TicketPrioritySchema>

export function isValidTicketTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return false
  const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
    open: ['pending', 'snoozed', 'resolved'],
    pending: ['open', 'resolved'],
    snoozed: ['open', 'resolved'],
    resolved: ['open'],
  }
  return allowedTransitions[from]?.includes(to) ?? false
}

export const CreateTicketInputSchema = z.object({
  conversationId: z.string().uuid('Conversation ID harus berupa UUID valid'),
  status: TicketStatusSchema.default('open'),
  priority: TicketPrioritySchema.default('medium'),
  assigneeId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  internalNote: z.string().nullable().optional(),
  snoozedUntil: z.string().or(z.date()).nullable().optional(),
  deadlineAt: z.string().or(z.date()).nullable().optional(),
  customAttributes: z.record(z.any()).default({}),
})
export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>

export const UpdateTicketStatusInputSchema = z.object({
  status: TicketStatusSchema,
  snoozedUntil: z.string().or(z.date()).nullable().optional(),
})
export type UpdateTicketStatusInput = z.infer<typeof UpdateTicketStatusInputSchema>

export const UpdateTicketInternalNoteInputSchema = z.object({
  internalNote: z.string(),
})
export type UpdateTicketInternalNoteInput = z.infer<typeof UpdateTicketInternalNoteInputSchema>

export const TicketSchema = z.object({
  id: z.string().uuid(),
  displayId: z.number().int().or(z.string()),
  conversationId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  status: TicketStatusSchema,
  priority: TicketPrioritySchema,
  snoozedUntil: z.string().or(z.date()).nullable().optional(),
  waitingSince: z.string().or(z.date()).nullable().optional(),
  deadlineAt: z.string().or(z.date()).nullable().optional(),
  firstReplyCreatedAt: z.string().or(z.date()).nullable().optional(),
  openedAt: z.string().or(z.date()),
  resolvedAt: z.string().or(z.date()).nullable().optional(),
  internalNote: z.string().nullable().optional(),
  internalNoteUpdatedBy: z.string().uuid().nullable().optional(),
  internalNoteUpdatedAt: z.string().or(z.date()).nullable().optional(),
  customAttributes: z.record(z.any()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Ticket = z.infer<typeof TicketSchema>

// ==========================================
// Phase 2: Team, Canned Response & Slash Command
// ==========================================

// 1. Team & Team Member Schemas
export const CreateTeamInputSchema = z.object({
  name: z.string().min(1, 'Nama tim wajib diisi').max(255),
  description: z.string().nullable().optional(),
  allowAutoAssign: z.boolean().default(true),
})
export type CreateTeamInput = z.infer<typeof CreateTeamInputSchema>

export const UpdateTeamInputSchema = CreateTeamInputSchema.partial()
export type UpdateTeamInput = z.infer<typeof UpdateTeamInputSchema>

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  allowAutoAssign: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Team = z.infer<typeof TeamSchema>

export const AddTeamMemberInputSchema = z.object({
  teamId: z.string().uuid('Team ID harus berupa UUID valid'),
  userId: z.string().uuid('User ID harus berupa UUID valid'),
})
export type AddTeamMemberInput = z.infer<typeof AddTeamMemberInputSchema>

export const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().or(z.date()),
})
export type TeamMember = z.infer<typeof TeamMemberSchema>

// 2. Canned Response Schemas
export const CreateCannedResponseInputSchema = z.object({
  shortCode: z.string().min(1, 'Short code wajib diisi').max(100),
  content: z.string().min(1, 'Konten balasan cepat wajib diisi'),
})
export type CreateCannedResponseInput = z.infer<typeof CreateCannedResponseInputSchema>

export const UpdateCannedResponseInputSchema = CreateCannedResponseInputSchema.partial()
export type UpdateCannedResponseInput = z.infer<typeof UpdateCannedResponseInputSchema>

export const CannedResponseSchema = z.object({
  id: z.string().uuid(),
  shortCode: z.string(),
  content: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type CannedResponse = z.infer<typeof CannedResponseSchema>

// 3. Slash Command Schemas
export const CreateSlashCommandInputSchema = z.object({
  name: z.string().min(1, 'Nama slash command wajib diisi').max(100),
  description: z.string().nullable().optional(),
  endpointUrl: z.string().url('Endpoint URL harus berupa URL valid'),
  authHeader: z.string().nullable().optional(),
})
export type CreateSlashCommandInput = z.infer<typeof CreateSlashCommandInputSchema>

export const UpdateSlashCommandInputSchema = CreateSlashCommandInputSchema.partial()
export type UpdateSlashCommandInput = z.infer<typeof UpdateSlashCommandInputSchema>

export const SlashCommandSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  endpointUrl: z.string(),
  authHeader: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type SlashCommand = z.infer<typeof SlashCommandSchema>

export const ExecuteSlashCommandInputSchema = z.object({
  command: z.string().min(1, 'Nama command wajib diisi'),
  conversationId: z.string().uuid('Conversation ID harus berupa UUID valid'),
  ticketId: z.string().uuid().nullable().optional(),
  params: z.string().nullable().optional(),
})
export type ExecuteSlashCommandInput = z.infer<typeof ExecuteSlashCommandInputSchema>

export const SlashCommandExecutionResponseSchema = z.object({
  content: z.string(),
  format: z.enum(['text', 'markdown', 'json']).default('text'),
  metadata: z.record(z.any()).default({}),
})
export type SlashCommandExecutionResponse = z.infer<typeof SlashCommandExecutionResponseSchema>

// ==========================================
// Phase 2: Assignment Engine (Task 2.14)
// ==========================================
export const AutoAssignInputSchema = z.object({
  ticketId: z.string().uuid().optional(),
  inboxId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
})
export type AutoAssignInput = z.infer<typeof AutoAssignInputSchema>

export const AutoAssignResultSchema = z.object({
  ticket: TicketSchema,
  assignedAgentId: z.string().uuid().nullable(),
  poolType: z.enum(['inbox', 'team', 'direct']),
  poolId: z.string().nullable().optional(),
  success: z.boolean(),
  reason: z.string().optional(),
})
export type AutoAssignResult = z.infer<typeof AutoAssignResultSchema>

export const UpdateUserAvailabilityInputSchema = z.object({
  availability: UserAvailabilitySchema,
})
export type UpdateUserAvailabilityInput = z.infer<typeof UpdateUserAvailabilityInputSchema>

// ==========================================
// Phase 5: Agent Capacity Policy Engine (Task 5.13)
// ==========================================

export const CreateCapacityPolicyInputSchema = z.object({
  name: z.string().min(1, 'Nama kebijakan kapasitas wajib diisi').max(255),
  description: z.string().optional(),
  maxActiveTickets: z
    .number()
    .int('Kapasitas harus berupa bilangan bulat')
    .positive('Kapasitas minimal 1 tiket aktif')
    .default(10),
  inboxId: z.string().uuid('inboxId harus berupa UUID valid').nullable().optional(),
  excludeSnoozed: z.boolean().default(false),
  active: z.boolean().default(true),
  accountId: z.never({ message: 'Single Organization: accountId dilarang' }).optional(),
  account_id: z.never({ message: 'Single Organization: account_id dilarang' }).optional(),
})
export type CreateCapacityPolicyInput = z.infer<typeof CreateCapacityPolicyInputSchema>

export const UpdateCapacityPolicyInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  maxActiveTickets: z
    .number()
    .int('Kapasitas harus berupa bilangan bulat')
    .positive('Kapasitas minimal 1 tiket aktif')
    .optional(),
  inboxId: z.string().uuid('inboxId harus berupa UUID valid').nullable().optional(),
  excludeSnoozed: z.boolean().optional(),
  active: z.boolean().optional(),
  accountId: z.never({ message: 'Single Organization: accountId dilarang' }).optional(),
  account_id: z.never({ message: 'Single Organization: account_id dilarang' }).optional(),
})
export type UpdateCapacityPolicyInput = z.infer<typeof UpdateCapacityPolicyInputSchema>

export const CapacityPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  maxActiveTickets: z.number().int(),
  inboxId: z.string().uuid().nullable().optional(),
  excludeSnoozed: z.boolean().default(false),
  active: z.boolean().default(true),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type CapacityPolicy = z.infer<typeof CapacityPolicySchema>

export const SetAgentCapacityOverrideInputSchema = z.object({
  maxActiveTickets: z.number().int().min(0, 'Kapasitas tidak boleh negatif').nullable().optional(),
  onLeave: z.boolean().default(false),
  leaveReason: z.string().optional(),
  leaveUntil: z.string().optional(),
  accountId: z.never({ message: 'Single Organization: accountId dilarang' }).optional(),
  account_id: z.never({ message: 'Single Organization: account_id dilarang' }).optional(),
})
export type SetAgentCapacityOverrideInput = z.infer<typeof SetAgentCapacityOverrideInputSchema>

export const AgentCapacityOverrideSchema = z.object({
  userId: z.string().uuid(),
  maxActiveTickets: z.number().int().nullable().optional(),
  onLeave: z.boolean().default(false),
  leaveReason: z.string().nullable().optional(),
  leaveUntil: z.string().nullable().optional(),
  updatedAt: z.string().or(z.date()),
})
export type AgentCapacityOverride = z.infer<typeof AgentCapacityOverrideSchema>

export const AgentWorkloadSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  email: z.string(),
  activeTicketCount: z.number().int(),
  maxCapacity: z.number().int(),
  availableCapacity: z.number().int(),
  utilizationPercentage: z.number(),
  isFull: z.boolean(),
  onLeave: z.boolean(),
})
export type AgentWorkload = z.infer<typeof AgentWorkloadSchema>
