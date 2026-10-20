import { z } from 'zod'

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
  inboxName: z.string().nullable().optional(),
  channelType: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Conversation = z.infer<typeof ConversationSchema>

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

export const MessageStatusSchema = z.enum([
  'sent',
  'delivered',
  'read',
  'failed',
  'deleted_by_sender',
])
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
  senderName: z.string().nullable().optional(),
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
  senderName: z.string().nullable().optional(),
  senderEmail: z.string().nullable().optional(),
  isEcho: z.boolean().optional(),
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
