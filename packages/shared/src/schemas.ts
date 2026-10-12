import { z } from 'zod'

export const OrganizationSetupInputSchema = z.object({
  organizationName: z.string().min(1, 'Nama organisasi wajib diisi'),
  adminName: z.string().min(1, 'Nama admin wajib diisi'),
  adminEmail: z.string().email('Format email tidak valid'),
  adminPassword: z.string().min(8, 'Password minimal 8 karakter'),
  timezone: z.string().default('UTC'),
  defaultLocale: z.string().default('en'),
})
export type OrganizationSetupInput = z.infer<typeof OrganizationSetupInputSchema>

export const LoginInputSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})
export type LoginInput = z.infer<typeof LoginInputSchema>

export const RoleSchema = z.enum(['owner', 'administrator', 'agent'])
export type Role = z.infer<typeof RoleSchema>

export const UserAvailabilitySchema = z.enum(['online', 'offline', 'busy'])
export type UserAvailability = z.infer<typeof UserAvailabilitySchema>

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: RoleSchema,
  customRoleId: z.string().uuid().nullable().optional(),
  availability: UserAvailabilitySchema.default('online'),
  avatarUrl: z.string().url().nullable().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().or(z.date()),
})
export type User = z.infer<typeof UserSchema>

export const UserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: RoleSchema,
})
export type UserRole = z.infer<typeof UserRoleSchema>

export const AuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().positive(),
  tokenType: z.literal('Bearer').default('Bearer'),
})
export type AuthTokens = z.infer<typeof AuthTokensSchema>

export const AuthSessionSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
})
export type AuthSession = z.infer<typeof AuthSessionSchema>

// ==========================================
// Phase 1: Channel & Inbox Configuration
// ==========================================

export const ChannelTypeSchema = z.enum([
  'whatsapp_cloud',
  'whatsapp_unofficial',
  'web_widget',
  'api',
  'email',
  'telegram',
  'facebook',
  'instagram',
  'sms',
])
export type ChannelType = z.infer<typeof ChannelTypeSchema>

export const SenderNameTypeSchema = z.enum(['friendly', 'professional'])
export type SenderNameType = z.infer<typeof SenderNameTypeSchema>

export const WhatsAppUnofficialConnectionStatusSchema = z.enum([
  'connected',
  'disconnected',
  'connecting',
  'qr_ready',
])
export type WhatsAppUnofficialConnectionStatus = z.infer<
  typeof WhatsAppUnofficialConnectionStatusSchema
>

export const WebWidgetReplyTimeSchema = z.enum(['in_a_few_minutes', 'in_a_few_hours', 'in_a_day'])
export type WebWidgetReplyTime = z.infer<typeof WebWidgetReplyTimeSchema>

// 1. WhatsApp Cloud Channel Schemas
export const CreateWhatsAppCloudChannelInputSchema = z.object({
  phoneNumber: z.string().min(1, 'Nomor telepon wajib diisi'),
  phoneNumberId: z.string().min(1, 'Phone Number ID wajib diisi'),
  wabaId: z.string().min(1, 'WABA ID wajib diisi'),
  accessToken: z.string().min(1, 'Access token wajib diisi'),
  webhookVerifyToken: z.string().min(1, 'Webhook verify token wajib diisi'),
})
export type CreateWhatsAppCloudChannelInput = z.infer<typeof CreateWhatsAppCloudChannelInputSchema>

export const WhatsAppCloudChannelSchema = z.object({
  id: z.string().uuid(),
  phoneNumber: z.string(),
  phoneNumberId: z.string(),
  wabaId: z.string(),
  accessToken: z.string(),
  webhookVerifyToken: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type WhatsAppCloudChannel = z.infer<typeof WhatsAppCloudChannelSchema>

// 2. WhatsApp Unofficial Channel Schemas
export const CreateWhatsAppUnofficialChannelInputSchema = z.object({
  sessionId: z.string().min(1, 'Session ID wajib diisi'),
  phoneNumber: z.string().nullable().optional(),
  connectionStatus: WhatsAppUnofficialConnectionStatusSchema.default('disconnected'),
  qrCode: z.string().nullable().optional(),
})
export type CreateWhatsAppUnofficialChannelInput = z.infer<
  typeof CreateWhatsAppUnofficialChannelInputSchema
>

export const WhatsAppUnofficialChannelSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  phoneNumber: z.string().nullable().optional(),
  connectionStatus: WhatsAppUnofficialConnectionStatusSchema,
  qrCode: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type WhatsAppUnofficialChannel = z.infer<typeof WhatsAppUnofficialChannelSchema>

// 3. Web Widget Channel Schemas
export const CreateWebWidgetChannelInputSchema = z.object({
  websiteToken: z.string().optional(),
  websiteUrl: z.string().url().nullable().optional().or(z.literal('')),
  allowedDomains: z.array(z.string()).default([]),
  widgetColor: z.string().default('#10b981'),
  replyTime: WebWidgetReplyTimeSchema.default('in_a_few_minutes'),
  preChatFormEnabled: z.boolean().default(false),
  hmacSecret: z.string().nullable().optional(),
})
export type CreateWebWidgetChannelInput = z.infer<typeof CreateWebWidgetChannelInputSchema>

export const WebWidgetChannelSchema = z.object({
  id: z.string().uuid(),
  websiteToken: z.string(),
  websiteUrl: z.string().nullable().optional(),
  allowedDomains: z.array(z.string()),
  widgetColor: z.string(),
  replyTime: WebWidgetReplyTimeSchema,
  preChatFormEnabled: z.boolean(),
  hmacSecret: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type WebWidgetChannel = z.infer<typeof WebWidgetChannelSchema>

// 4. API Channel Schemas
export const CreateApiChannelInputSchema = z.object({
  name: z.string().min(1, 'Nama API channel wajib diisi'),
  webhookUrl: z.string().url().nullable().optional().or(z.literal('')),
  apiKeyHash: z.string().optional(),
  authToken: z.string().nullable().optional(),
})
export type CreateApiChannelInput = z.infer<typeof CreateApiChannelInputSchema>

export const ApiChannelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  webhookUrl: z.string().nullable().optional(),
  apiKeyHash: z.string(),
  authToken: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type ApiChannel = z.infer<typeof ApiChannelSchema>

// 5. Inbox Schemas
export const CreateInboxInputSchema = z.object({
  name: z.string().min(1, 'Nama inbox wajib diisi'),
  channelType: ChannelTypeSchema,
  channelId: z.string().uuid('Channel ID harus berupa UUID valid'),
  enableAutoAssign: z.boolean().default(true),
  greetingEnabled: z.boolean().default(false),
  greetingMessage: z.string().nullable().optional(),
  workingHoursEnabled: z.boolean().default(false),
  workingHours: z.record(z.any()).default({}),
  outOfOfficeMessage: z.string().nullable().optional(),
  lockToSingleConv: z.boolean().default(false),
  senderNameType: SenderNameTypeSchema.default('friendly'),
})
export type CreateInboxInput = z.infer<typeof CreateInboxInputSchema>

export const UpdateInboxInputSchema = CreateInboxInputSchema.partial()
export type UpdateInboxInput = z.infer<typeof UpdateInboxInputSchema>

export const InboxSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  channelType: ChannelTypeSchema,
  channelId: z.string().uuid(),
  enableAutoAssign: z.boolean(),
  greetingEnabled: z.boolean(),
  greetingMessage: z.string().nullable().optional(),
  workingHoursEnabled: z.boolean(),
  workingHours: z.record(z.any()),
  outOfOfficeMessage: z.string().nullable().optional(),
  lockToSingleConv: z.boolean(),
  senderNameType: SenderNameTypeSchema,
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Inbox = z.infer<typeof InboxSchema>

// 6. Inbox Member Schemas
export const InboxMemberSchema = z.object({
  inboxId: z.string().uuid(),
  userId: z.string().uuid(),
})
export type InboxMember = z.infer<typeof InboxMemberSchema>

export const AddInboxMemberInputSchema = InboxMemberSchema
export type AddInboxMemberInput = z.infer<typeof AddInboxMemberInputSchema>

// ==========================================
// Phase 1: Contact, ContactInbox & Company
// ==========================================

export const ContactTypeSchema = z.enum(['lead', 'customer', 'partner'])
export type ContactType = z.infer<typeof ContactTypeSchema>

// 1. Company Schemas
export const CreateCompanyInputSchema = z.object({
  name: z.string().min(1, 'Nama perusahaan wajib diisi'),
  domain: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  customAttributes: z.record(z.any()).default({}),
})
export type CreateCompanyInput = z.infer<typeof CreateCompanyInputSchema>

export const UpdateCompanyInputSchema = CreateCompanyInputSchema.partial()
export type UpdateCompanyInput = z.infer<typeof UpdateCompanyInputSchema>

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  domain: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  customAttributes: z.record(z.any()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Company = z.infer<typeof CompanySchema>

// 2. Contact Schemas
export const CreateContactInputSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  email: z.string().email('Format email tidak valid').nullable().optional().or(z.literal('')),
  avatarUrl: z.string().url().nullable().optional().or(z.literal('')),
  identifier: z.string().nullable().optional(),
  contactType: ContactTypeSchema.default('lead'),
  customAttributes: z.record(z.any()).default({}),
  additionalAttributes: z.record(z.any()).default({}),
  blocked: z.boolean().default(false),
})
export type CreateContactInput = z.infer<typeof CreateContactInputSchema>

export const UpdateContactInputSchema = CreateContactInputSchema.partial()
export type UpdateContactInput = z.infer<typeof UpdateContactInputSchema>

export const ContactSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  identifier: z.string().nullable().optional(),
  contactType: ContactTypeSchema,
  customAttributes: z.record(z.any()),
  additionalAttributes: z.record(z.any()),
  blocked: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Contact = z.infer<typeof ContactSchema>

// 3. ContactInbox Schemas
export const CreateContactInboxInputSchema = z.object({
  contactId: z.string().uuid('Contact ID harus berupa UUID valid'),
  inboxId: z.string().uuid('Inbox ID harus berupa UUID valid'),
  sourceId: z.string().min(1, 'Source ID wajib diisi'),
  hmacVerified: z.boolean().default(false),
})
export type CreateContactInboxInput = z.infer<typeof CreateContactInboxInputSchema>

export const ContactInboxSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  inboxId: z.string().uuid(),
  sourceId: z.string(),
  hmacVerified: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type ContactInbox = z.infer<typeof ContactInboxSchema>

// 4. Conversation Schemas
export const ConversationSchema = z.object({
  id: z.string().uuid(),
  inboxId: z.string().uuid(),
  contactId: z.string().uuid().nullable().optional(),
  contactInboxId: z.string().uuid().nullable().optional(),
  activeTicketId: z.string().uuid().nullable().optional(),
  unreadCount: z.number().int().default(0),
  lastMessageAt: z.string().or(z.date()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Conversation = z.infer<typeof ConversationSchema>

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
// Phase 1: Message Payload & Communications
// ==========================================

export const MessageSenderTypeSchema = z.enum(['user', 'contact', 'bot', 'system'])
export type MessageSenderType = z.infer<typeof MessageSenderTypeSchema>

export const MessageTypeSchema = z.enum(['incoming', 'outgoing', 'activity', 'template'])
export type MessageType = z.infer<typeof MessageTypeSchema>

export const MessageContentTypeSchema = z.enum([
  'text',
  'image',
  'video',
  'audio',
  'file',
  'location',
  'interactive',
])
export type MessageContentType = z.infer<typeof MessageContentTypeSchema>

export const MessageStatusSchema = z.enum(['sent', 'delivered', 'read', 'failed'])
export type MessageStatus = z.infer<typeof MessageStatusSchema>

export const AttachmentInputSchema = z.object({
  fileType: z.string().min(1, 'File type wajib diisi'),
  fileUrl: z.string().url('File URL harus berupa URL valid'),
  thumbUrl: z.string().url().nullable().optional(),
  fileSize: z.number().nonnegative().default(0),
  fileName: z.string().nullable().optional(),
  metadata: z.record(z.any()).default({}),
})
export type AttachmentInput = z.infer<typeof AttachmentInputSchema>

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  fileType: z.string(),
  fileUrl: z.string(),
  thumbUrl: z.string().nullable().optional(),
  fileSize: z.number().nonnegative(),
  fileName: z.string().nullable().optional(),
  metadata: z.record(z.any()),
  createdAt: z.string().or(z.date()),
})
export type Attachment = z.infer<typeof AttachmentSchema>

export const CreateMessageInputSchema = z.object({
  conversationId: z.string().uuid('Conversation ID harus berupa UUID valid'),
  ticketId: z.string().uuid().nullable().optional(),
  senderType: MessageSenderTypeSchema,
  senderId: z.string().uuid().nullable().optional(),
  messageType: MessageTypeSchema.default('incoming'),
  content: z.string().nullable().optional(),
  contentType: MessageContentTypeSchema.default('text'),
  status: MessageStatusSchema.default('sent'),
  externalSourceId: z.string().nullable().optional(),
  contentAttributes: z.record(z.any()).default({}),
  attachments: z.array(AttachmentInputSchema).default([]),
})
export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  ticketId: z.string().uuid().nullable().optional(),
  senderType: MessageSenderTypeSchema,
  senderId: z.string().uuid().nullable().optional(),
  messageType: MessageTypeSchema,
  content: z.string().nullable().optional(),
  contentType: MessageContentTypeSchema,
  status: MessageStatusSchema,
  externalSourceId: z.string().nullable().optional(),
  contentAttributes: z.record(z.any()),
  attachments: z.array(AttachmentSchema).optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Message = z.infer<typeof MessageSchema>

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
// Phase 2: Visual Bot Engine AST Nodes & Edges (Task 2.9)
// ==========================================

export const BotNodeTypeSchema = z.enum(['message', 'question', 'http', 'branch', 'handoff'])
export type BotNodeType = z.infer<typeof BotNodeTypeSchema>

// 1. MessageNode
export const MessageNodeDataSchema = z.object({
  text: z.string().min(1, 'Pesan teks wajib diisi'),
  mediaUrl: z.string().url().nullable().optional(),
  mediaType: z.enum(['image', 'video', 'document', 'audio']).nullable().optional(),
})
export type MessageNodeData = z.infer<typeof MessageNodeDataSchema>

export const MessageNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('message'),
  name: z.string().optional(),
  data: MessageNodeDataSchema,
})
export type MessageNode = z.infer<typeof MessageNodeSchema>

// 2. QuestionNode
export const QuestionChoiceOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
})
export type QuestionChoiceOption = z.infer<typeof QuestionChoiceOptionSchema>

export const QuestionNodeDataSchema = z.object({
  question: z.string().min(1, 'Teks pertanyaan wajib diisi'),
  questionType: z.enum(['text', 'choice', 'number', 'email', 'phone']).default('text'),
  variableName: z.string().min(1, 'Nama variabel wajib diisi'),
  options: z.array(QuestionChoiceOptionSchema).optional().default([]),
})
export type QuestionNodeData = z.infer<typeof QuestionNodeDataSchema>

export const QuestionNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('question'),
  name: z.string().optional(),
  data: QuestionNodeDataSchema,
})
export type QuestionNode = z.infer<typeof QuestionNodeSchema>

// 3. HttpNode
export const HttpNodeDataSchema = z.object({
  url: z.string().url('URL endpoint harus berupa URL valid'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  headers: z.record(z.string()).optional().default({}),
  body: z.string().nullable().optional(),
  responseVariable: z.string().min(1, 'Nama variabel penyimpan respons wajib diisi'),
  timeoutMs: z.number().int().positive().optional().default(5000),
})
export type HttpNodeData = z.infer<typeof HttpNodeDataSchema>

export const HttpNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('http'),
  name: z.string().optional(),
  data: HttpNodeDataSchema,
})
export type HttpNode = z.infer<typeof HttpNodeSchema>

// 4. BranchNode
export const BranchConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty',
])
export type BranchConditionOperator = z.infer<typeof BranchConditionOperatorSchema>

export const BranchConditionRuleSchema = z.object({
  id: z.string().optional(),
  variable: z.string().min(1, 'Variabel kondisi wajib diisi'),
  operator: BranchConditionOperatorSchema,
  value: z.any().optional(),
  targetNodeId: z.string().optional(),
})
export type BranchConditionRule = z.infer<typeof BranchConditionRuleSchema>

export const BranchNodeDataSchema = z.object({
  conditions: z.array(BranchConditionRuleSchema).min(1, 'Minimal satu kondisi wajib diisi'),
  fallbackNodeId: z.string().nullable().optional(),
})
export type BranchNodeData = z.infer<typeof BranchNodeDataSchema>

export const BranchNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('branch'),
  name: z.string().optional(),
  data: BranchNodeDataSchema,
})
export type BranchNode = z.infer<typeof BranchNodeSchema>

// 5. HandoffNode
export const HandoffNodeDataSchema = z.object({
  teamId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  handoffMessage: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
})
export type HandoffNodeData = z.infer<typeof HandoffNodeDataSchema>

export const HandoffNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('handoff'),
  name: z.string().optional(),
  data: HandoffNodeDataSchema,
})
export type HandoffNode = z.infer<typeof HandoffNodeSchema>

// Discriminated union of AST nodes
export const BotNodeSchema = z.discriminatedUnion('type', [
  MessageNodeSchema,
  QuestionNodeSchema,
  HttpNodeSchema,
  BranchNodeSchema,
  HandoffNodeSchema,
])
export type BotNode = z.infer<typeof BotNodeSchema>

// 6. BotEdge Schema
export const BotEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1, 'Source node ID wajib diisi'),
  target: z.string().min(1, 'Target node ID wajib diisi'),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
})
export type BotEdge = z.infer<typeof BotEdgeSchema>

// 7. BotFlowDefinition AST Graph Schema
export const BotFlowDefinitionSchema = z.object({
  startNodeId: z.string().min(1, 'Start node ID wajib diisi'),
  nodes: z.array(BotNodeSchema).min(1, 'Minimal satu node diperlukan'),
  edges: z.array(BotEdgeSchema).default([]),
  variables: z.record(z.any()).optional().default({}),
})
export type BotFlowDefinition = z.infer<typeof BotFlowDefinitionSchema>

// 8. BotFlow Entity & Input Schemas
export const BotTriggerTypeSchema = z.enum([
  'conversation_opened',
  'message_received',
  'manual',
  'custom',
])
export type BotTriggerType = z.infer<typeof BotTriggerTypeSchema>

export const CreateBotFlowInputSchema = z.object({
  name: z.string().min(1, 'Nama bot flow wajib diisi'),
  triggerType: BotTriggerTypeSchema.default('conversation_opened'),
  active: z.boolean().default(true),
  flowDefinition: BotFlowDefinitionSchema,
})
export type CreateBotFlowInput = z.infer<typeof CreateBotFlowInputSchema>

export const UpdateBotFlowInputSchema = CreateBotFlowInputSchema.partial()
export type UpdateBotFlowInput = z.infer<typeof UpdateBotFlowInputSchema>

export const BotFlowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  triggerType: BotTriggerTypeSchema,
  active: z.boolean(),
  flowDefinition: BotFlowDefinitionSchema,
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type BotFlow = z.infer<typeof BotFlowSchema>

// 9. BotSession Entity Schemas
export const BotSessionStatusSchema = z.enum(['active', 'paused', 'completed', 'handoff', 'failed'])
export type BotSessionStatus = z.infer<typeof BotSessionStatusSchema>

export const BotSessionSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  flowId: z.string().uuid(),
  currentNodeId: z.string().nullable().optional(),
  status: BotSessionStatusSchema,
  contextData: z.record(z.any()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type BotSession = z.infer<typeof BotSessionSchema>

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
// Phase 3: Omnichannel Communication Channels (Task 3.4)
// ==========================================

// 1. Email Channel Schemas
export const CreateEmailChannelInputSchema = z.object({
  imapHost: z.string().min(1, 'Host IMAP wajib diisi'),
  imapPort: z.number().int().positive('Port IMAP harus berupa angka positif').default(993),
  imapUsername: z.string().min(1, 'Username IMAP wajib diisi'),
  imapPassword: z.string().min(1, 'Password IMAP wajib diisi'),
  smtpHost: z.string().min(1, 'Host SMTP wajib diisi'),
  smtpPort: z.number().int().positive('Port SMTP harus berupa angka positif').default(587),
  smtpUsername: z.string().min(1, 'Username SMTP wajib diisi'),
  smtpPassword: z.string().min(1, 'Password SMTP wajib diisi'),
})
export type CreateEmailChannelInput = z.infer<typeof CreateEmailChannelInputSchema>

export const UpdateEmailChannelInputSchema = CreateEmailChannelInputSchema.partial()
export type UpdateEmailChannelInput = z.infer<typeof UpdateEmailChannelInputSchema>

export const EmailChannelSchema = z.object({
  id: z.string().uuid(),
  imapHost: z.string(),
  imapPort: z.number().int(),
  imapUsername: z.string(),
  imapPasswordEncrypted: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number().int(),
  smtpUsername: z.string(),
  smtpPasswordEncrypted: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type EmailChannel = z.infer<typeof EmailChannelSchema>

// 2. Telegram Channel Schemas
export const CreateTelegramChannelInputSchema = z.object({
  botToken: z.string().min(1, 'Bot Token Telegram wajib diisi'),
  botUsername: z.string().min(1, 'Bot Username Telegram wajib diisi'),
})
export type CreateTelegramChannelInput = z.infer<typeof CreateTelegramChannelInputSchema>

export const UpdateTelegramChannelInputSchema = CreateTelegramChannelInputSchema.partial()
export type UpdateTelegramChannelInput = z.infer<typeof UpdateTelegramChannelInputSchema>

export const TelegramChannelSchema = z.object({
  id: z.string().uuid(),
  botTokenEncrypted: z.string(),
  botUsername: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type TelegramChannel = z.infer<typeof TelegramChannelSchema>

// 3. Facebook Messenger Channel Schemas
export const CreateFacebookChannelInputSchema = z.object({
  pageId: z.string().min(1, 'Page ID Facebook wajib diisi'),
  pageAccessToken: z.string().min(1, 'Page Access Token Facebook wajib diisi'),
})
export type CreateFacebookChannelInput = z.infer<typeof CreateFacebookChannelInputSchema>

export const UpdateFacebookChannelInputSchema = CreateFacebookChannelInputSchema.partial()
export type UpdateFacebookChannelInput = z.infer<typeof UpdateFacebookChannelInputSchema>

export const FacebookChannelSchema = z.object({
  id: z.string().uuid(),
  pageId: z.string(),
  pageAccessTokenEncrypted: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type FacebookChannel = z.infer<typeof FacebookChannelSchema>

// 4. Instagram Messaging Channel Schemas
export const CreateInstagramChannelInputSchema = z.object({
  igUserId: z.string().min(1, 'Instagram User ID wajib diisi'),
  igAccessToken: z.string().min(1, 'Instagram Access Token wajib diisi'),
})
export type CreateInstagramChannelInput = z.infer<typeof CreateInstagramChannelInputSchema>

export const UpdateInstagramChannelInputSchema = CreateInstagramChannelInputSchema.partial()
export type UpdateInstagramChannelInput = z.infer<typeof UpdateInstagramChannelInputSchema>

export const InstagramChannelSchema = z.object({
  id: z.string().uuid(),
  igUserId: z.string(),
  igAccessTokenEncrypted: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type InstagramChannel = z.infer<typeof InstagramChannelSchema>

// 5. SMS Channel Schemas
export const CreateSmsChannelInputSchema = z.object({
  providerName: z.string().default('twilio'),
  accountSid: z.string().min(1, 'Account SID wajib diisi'),
  authToken: z.string().min(1, 'Auth Token SMS wajib diisi'),
  fromPhoneNumber: z.string().min(1, 'Nomor Telepon Pengirim (From Phone Number) wajib diisi'),
})
export type CreateSmsChannelInput = z.infer<typeof CreateSmsChannelInputSchema>

export const UpdateSmsChannelInputSchema = CreateSmsChannelInputSchema.partial()
export type UpdateSmsChannelInput = z.infer<typeof UpdateSmsChannelInputSchema>

export const SmsChannelSchema = z.object({
  id: z.string().uuid(),
  providerName: z.string(),
  accountSid: z.string(),
  authTokenEncrypted: z.string(),
  fromPhoneNumber: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type SmsChannel = z.infer<typeof SmsChannelSchema>

// ==========================================
// Phase 3: Business Hours & Weekly Schedule (Task 3.5)
// ==========================================

export const DayOfWeekNameSchema = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
])
export type DayOfWeekName = z.infer<typeof DayOfWeekNameSchema>

export const DayOfWeekSchema = z.union([z.number().int().min(0).max(6), DayOfWeekNameSchema])
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>

export const DayScheduleSchema = z
  .object({
    dayOfWeek: DayOfWeekSchema,
    openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format openTime harus HH:mm (24-jam)'),
    closeTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format closeTime harus HH:mm (24-jam)'),
    isEnabled: z.boolean().default(true),
    openAllDay: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (!data.isEnabled || data.openAllDay) {
        return true
      }
      return data.closeTime > data.openTime
    },
    {
      message: 'closeTime harus setelah openTime ketika isEnabled aktif',
      path: ['closeTime'],
    },
  )
export type DaySchedule = z.infer<typeof DayScheduleSchema>

export const WeeklyScheduleSchema = z
  .array(DayScheduleSchema)
  .max(7, 'Jadwal mingguan maksimal 7 hari')
  .refine(
    (days) => {
      const seenDays = new Set<number>()
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      }

      for (const day of days) {
        let normalizedDay: number
        if (typeof day.dayOfWeek === 'number') {
          normalizedDay = day.dayOfWeek
        } else {
          normalizedDay = dayMap[day.dayOfWeek.toLowerCase()] ?? -1
        }

        if (seenDays.has(normalizedDay)) {
          return false
        }
        seenDays.add(normalizedDay)
      }
      return true
    },
    {
      message: 'Tidak boleh ada hari yang duplikat dalam jadwal mingguan',
    },
  )
export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>

export const CreateBusinessHoursInputSchema = z.object({
  inboxId: z.string().uuid('Inbox ID harus berformat UUID yang valid'),
  timezone: z.string().min(1, 'Timezone wajib diisi').default('Asia/Jakarta'),
  weeklySchedule: WeeklyScheduleSchema.default([]),
  outOfOfficeMessage: z
    .string()
    .min(1, 'Pesan di luar jam kerja wajib diisi')
    .default(
      'Halo, terima kasih telah menghubungi kami. Saat ini kami sedang di luar jam operasional kerja.',
    ),
  enabled: z.boolean().default(true),
})
export type CreateBusinessHoursInput = z.infer<typeof CreateBusinessHoursInputSchema>

export const UpdateBusinessHoursInputSchema = z.object({
  timezone: z.string().min(1).optional(),
  weeklySchedule: WeeklyScheduleSchema.optional(),
  outOfOfficeMessage: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
})
export type UpdateBusinessHoursInput = z.infer<typeof UpdateBusinessHoursInputSchema>

export const BusinessHoursSchema = z.object({
  id: z.string().uuid(),
  inboxId: z.string().uuid(),
  timezone: z.string(),
  weeklySchedule: WeeklyScheduleSchema,
  outOfOfficeMessage: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type BusinessHours = z.infer<typeof BusinessHoursSchema>

// ==========================================
// Phase 3: Customer Satisfaction (CSAT) Surveys (Task 3.6)
// ==========================================

export const CsatRatingSchema = z
  .number()
  .int('Rating harus berupa bilangan bulat')
  .min(1, 'Rating minimal 1')
  .max(5, 'Rating maksimal 5')
export type CsatRating = z.infer<typeof CsatRatingSchema>

export const SubmitCsatSurveyInputSchema = z.object({
  ticketId: z.string().uuid('Ticket ID harus berformat UUID yang valid'),
  rating: CsatRatingSchema,
  feedbackText: z
    .string()
    .max(2000, 'Teks umpan balik maksimal 2000 karakter')
    .nullable()
    .optional(),
})
export type SubmitCsatSurveyInput = z.infer<typeof SubmitCsatSurveyInputSchema>

export const CreateCsatSurveyInputSchema = z.object({
  ticketId: z.string().uuid('Ticket ID harus berformat UUID yang valid'),
  contactId: z.string().uuid('Contact ID harus berformat UUID yang valid'),
  rating: CsatRatingSchema,
  feedbackText: z
    .string()
    .max(2000, 'Teks umpan balik maksimal 2000 karakter')
    .nullable()
    .optional(),
  submittedAt: z.string().or(z.date()).optional(),
})
export type CreateCsatSurveyInput = z.infer<typeof CreateCsatSurveyInputSchema>

export const UpdateCsatSurveyInputSchema = z.object({
  rating: CsatRatingSchema.optional(),
  feedbackText: z
    .string()
    .max(2000, 'Teks umpan balik maksimal 2000 karakter')
    .nullable()
    .optional(),
})
export type UpdateCsatSurveyInput = z.infer<typeof UpdateCsatSurveyInputSchema>

export const CsatSurveySchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  contactId: z.string().uuid(),
  rating: CsatRatingSchema,
  feedbackText: z.string().nullable().optional(),
  submittedAt: z.string().or(z.date()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type CsatSurvey = z.infer<typeof CsatSurveySchema>

export const CsatSurveyMetricsSchema = z.object({
  totalSurveys: z.number().int().nonnegative(),
  averageRating: z.number().min(0).max(5),
  csatScorePercentage: z.number().min(0).max(100),
  ratingDistribution: z.record(z.string(), z.number().int()),
})
export type CsatSurveyMetrics = z.infer<typeof CsatSurveyMetricsSchema>

// ==========================================
// Phase 4: Reporting & Metrics Filters (Task 4.5)
// ==========================================

export const ReportMetricTypeSchema = z.enum([
  'conversations_count',
  'incoming_messages_count',
  'outgoing_messages_count',
  'first_response_time',
  'resolution_time',
  'csat_score',
])
export type ReportMetricType = z.infer<typeof ReportMetricTypeSchema>

export const ReportGroupBySchema = z.enum([
  'day',
  'week',
  'month',
  'year',
  'agent',
  'inbox',
  'team',
  'label',
])
export type ReportGroupBy = z.infer<typeof ReportGroupBySchema>

export const ReportFilterQueryRawSchema = z.object({
  since: z.string().or(z.date()).optional(),
  until: z.string().or(z.date()).optional(),
  agentId: z.string().uuid('Agent ID harus berformat UUID yang valid').optional(),
  userId: z.string().uuid('User ID harus berformat UUID yang valid').optional(),
  inboxId: z.string().uuid('Inbox ID harus berformat UUID yang valid').optional(),
  teamId: z.string().uuid('Team ID harus berformat UUID yang valid').optional(),
  labelId: z.string().uuid('Label ID harus berformat UUID yang valid').optional(),
  type: ReportMetricTypeSchema.optional(),
  groupBy: ReportGroupBySchema.optional(),
})

export const ReportFilterQuerySchema = ReportFilterQueryRawSchema.refine(
  (data) => {
    if (data.since && data.until) {
      const sinceDate = new Date(data.since)
      const untilDate = new Date(data.until)
      return sinceDate.getTime() <= untilDate.getTime()
    }
    return true
  },
  {
    message: 'Waktu mulai (since) tidak boleh lebih besar dari waktu selesai (until)',
    path: ['since'],
  },
)
export type ReportFilterQuery = z.infer<typeof ReportFilterQueryRawSchema>

export const ReportingEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  conversationId: z.string().uuid().nullable().optional(),
  ticketId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  inboxId: z.string().uuid().nullable().optional(),
  valueInSeconds: z.number().int().nullable().optional(),
  createdAt: z.string().or(z.date()),
})
export type ReportingEvent = z.infer<typeof ReportingEventSchema>

export const ReportingMetricSummarySchema = z.object({
  conversationsCount: z.number().int().nonnegative().default(0),
  incomingMessagesCount: z.number().int().nonnegative().default(0),
  outgoingMessagesCount: z.number().int().nonnegative().default(0),
  avgFirstResponseTimeSeconds: z.number().nonnegative().default(0),
  avgResolutionTimeSeconds: z.number().nonnegative().default(0),
  avgCsatScore: z.number().min(0).max(5).default(0),
  totalResolvedTickets: z.number().int().nonnegative().default(0),
})
export type ReportingMetricSummary = z.infer<typeof ReportingMetricSummarySchema>

export const ReportingDataPointSchema = z.object({
  timestamp: z.string().or(z.date()),
  value: z.number(),
  count: z.number().int().optional(),
  agentId: z.string().uuid().optional(),
  inboxId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
})
export type ReportingDataPoint = z.infer<typeof ReportingDataPointSchema>

// ==========================================
// Phase 4: Help Center & Knowledge Base (Task 4.6)
// ==========================================

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// 1. Portal Schemas
export const CreatePortalInputSchema = z.object({
  name: z.string().min(1, 'Nama portal wajib diisi').max(255),
  slug: z
    .string()
    .min(1, 'Slug portal wajib diisi')
    .max(255)
    .regex(SLUG_REGEX, 'Slug hanya boleh memuat huruf kecil, angka, dan tanda hubung (-)'),
  customDomain: z.string().max(255).nullable().optional(),
  headerText: z.string().nullable().optional(),
  logoUrl: z.string().url('URL logo tidak valid').nullable().optional(),
})
export type CreatePortalInput = z.infer<typeof CreatePortalInputSchema>

export const UpdatePortalInputSchema = CreatePortalInputSchema.partial()
export type UpdatePortalInput = z.infer<typeof UpdatePortalInputSchema>

export const PortalSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  customDomain: z.string().nullable().optional(),
  headerText: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Portal = z.infer<typeof PortalSchema>

// 2. Portal Category Schemas
export const CreatePortalCategoryInputSchema = z.object({
  portalId: z.string().uuid('Portal ID harus berformat UUID yang valid'),
  name: z.string().min(1, 'Nama kategori wajib diisi').max(255),
  slug: z
    .string()
    .min(1, 'Slug kategori wajib diisi')
    .max(255)
    .regex(SLUG_REGEX, 'Slug hanya boleh memuat huruf kecil, angka, dan tanda hubung (-)'),
  description: z.string().nullable().optional(),
  position: z.number().int().nonnegative().default(0),
})
export type CreatePortalCategoryInput = z.infer<typeof CreatePortalCategoryInputSchema>

export const UpdatePortalCategoryInputSchema = CreatePortalCategoryInputSchema.partial().omit({
  portalId: true,
})
export type UpdatePortalCategoryInput = z.infer<typeof UpdatePortalCategoryInputSchema>

export const PortalCategorySchema = z.object({
  id: z.string().uuid(),
  portalId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  position: z.number().int(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type PortalCategory = z.infer<typeof PortalCategorySchema>

// Category Schema Aliases
export const CreateCategoryInputSchema = CreatePortalCategoryInputSchema
export type CreateCategoryInput = CreatePortalCategoryInput
export const UpdateCategoryInputSchema = UpdatePortalCategoryInputSchema
export type UpdateCategoryInput = UpdatePortalCategoryInput
export const CategorySchema = PortalCategorySchema
export type Category = PortalCategory

// 3. Portal Article Schemas
export const ArticleStatusSchema = z.enum(['draft', 'published', 'archived'])
export type ArticleStatus = z.infer<typeof ArticleStatusSchema>

export const CreatePortalArticleInputSchema = z.object({
  categoryId: z.string().uuid('Category ID harus berformat UUID yang valid'),
  authorId: z.string().uuid('Author ID harus berformat UUID yang valid').nullable().optional(),
  title: z.string().min(1, 'Judul artikel wajib diisi').max(255),
  slug: z
    .string()
    .min(1, 'Slug artikel wajib diisi')
    .max(255)
    .regex(SLUG_REGEX, 'Slug hanya boleh memuat huruf kecil, angka, dan tanda hubung (-)'),
  contentMarkdown: z.string().default(''),
  status: ArticleStatusSchema.default('draft'),
})
export type CreatePortalArticleInput = z.infer<typeof CreatePortalArticleInputSchema>

export const UpdatePortalArticleInputSchema = z.object({
  categoryId: z.string().uuid('Category ID harus berformat UUID yang valid').optional(),
  authorId: z.string().uuid('Author ID harus berformat UUID yang valid').nullable().optional(),
  title: z.string().min(1, 'Judul artikel wajib diisi').max(255).optional(),
  slug: z
    .string()
    .min(1, 'Slug artikel wajib diisi')
    .max(255)
    .regex(SLUG_REGEX, 'Slug hanya boleh memuat huruf kecil, angka, dan tanda hubung (-)')
    .optional(),
  contentMarkdown: z.string().optional(),
  status: ArticleStatusSchema.optional(),
})
export type UpdatePortalArticleInput = z.infer<typeof UpdatePortalArticleInputSchema>

export const PortalArticleSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  authorId: z.string().uuid().nullable().optional(),
  title: z.string(),
  slug: z.string(),
  contentMarkdown: z.string(),
  status: ArticleStatusSchema,
  viewsCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type PortalArticle = z.infer<typeof PortalArticleSchema>

// Article Schema Aliases
export const CreateArticleInputSchema = CreatePortalArticleInputSchema
export type CreateArticleInput = CreatePortalArticleInput
export const UpdateArticleInputSchema = UpdatePortalArticleInputSchema
export type UpdateArticleInput = UpdatePortalArticleInput
export const ArticleSchema = PortalArticleSchema
export type Article = PortalArticle

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
