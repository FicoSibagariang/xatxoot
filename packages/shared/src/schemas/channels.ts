import { z } from 'zod'

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
