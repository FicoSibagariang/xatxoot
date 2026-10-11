import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ChannelTypeSchema,
  CreateEmailChannelInputSchema,
  CreateFacebookChannelInputSchema,
  CreateInstagramChannelInputSchema,
  CreateSmsChannelInputSchema,
  CreateTelegramChannelInputSchema,
  EmailChannelSchema,
  FacebookChannelSchema,
  InstagramChannelSchema,
  SmsChannelSchema,
  TelegramChannelSchema,
} from './schemas'

describe('Omnichannel Channel Configuration Schemas (Task 3.4 - packages/shared)', () => {
  describe('ChannelTypeSchema Expansion', () => {
    it('should include new Phase 3 channels: email, telegram, facebook, instagram, sms', () => {
      const validChannels = [
        'whatsapp_cloud',
        'whatsapp_unofficial',
        'web_widget',
        'api',
        'email',
        'telegram',
        'facebook',
        'instagram',
        'sms',
      ]

      for (const ch of validChannels) {
        expect(ChannelTypeSchema.safeParse(ch).success).toBe(true)
      }

      expect(ChannelTypeSchema.safeParse('invalid_channel').success).toBe(false)
    })
  })

  describe('Email Channel Configuration Schemas', () => {
    it('should validate valid CreateEmailChannelInputSchema with default ports', () => {
      const input = {
        imapHost: 'imap.mail.example.com',
        imapUsername: 'support@example.com',
        imapPassword: 'secret-imap-password',
        smtpHost: 'smtp.mail.example.com',
        smtpUsername: 'support@example.com',
        smtpPassword: 'secret-smtp-password',
      }

      const result = CreateEmailChannelInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.imapPort).toBe(993)
        expect(result.data.smtpPort).toBe(587)
      }
    })

    it('should allow custom ports in CreateEmailChannelInputSchema', () => {
      const input = {
        imapHost: 'imap.mail.example.com',
        imapPort: 143,
        imapUsername: 'support@example.com',
        imapPassword: 'secret-imap-password',
        smtpHost: 'smtp.mail.example.com',
        smtpPort: 25,
        smtpUsername: 'support@example.com',
        smtpPassword: 'secret-smtp-password',
      }

      const result = CreateEmailChannelInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.imapPort).toBe(143)
        expect(result.data.smtpPort).toBe(25)
      }
    })

    it('should validate persisted EmailChannelSchema', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174011',
        imapHost: 'imap.mail.example.com',
        imapPort: 993,
        imapUsername: 'support@example.com',
        imapPasswordEncrypted: 'enc:v1:imap...',
        smtpHost: 'smtp.mail.example.com',
        smtpPort: 587,
        smtpUsername: 'support@example.com',
        smtpPasswordEncrypted: 'enc:v1:smtp...',
        createdAt: '2026-10-10T10:00:00Z',
        updatedAt: '2026-10-10T10:00:00Z',
      }

      expect(EmailChannelSchema.safeParse(entity).success).toBe(true)
    })
  })

  describe('Telegram Channel Configuration Schemas', () => {
    it('should validate CreateTelegramChannelInputSchema and TelegramChannelSchema', () => {
      const input = {
        botToken: '123456789:ABCdefGhIJKlmNoPQRstuVWXyz',
        botUsername: 'xatxoot_support_bot',
      }
      expect(CreateTelegramChannelInputSchema.safeParse(input).success).toBe(true)

      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174022',
        botTokenEncrypted: 'enc:v1:telegram...',
        botUsername: 'xatxoot_support_bot',
        createdAt: '2026-10-10T10:00:00Z',
        updatedAt: '2026-10-10T10:00:00Z',
      }
      expect(TelegramChannelSchema.safeParse(entity).success).toBe(true)
    })

    it('should reject empty botToken in CreateTelegramChannelInputSchema', () => {
      const input = {
        botToken: '',
        botUsername: 'xatxoot_support_bot',
      }
      expect(CreateTelegramChannelInputSchema.safeParse(input).success).toBe(false)
    })
  })

  describe('Facebook & Instagram Channel Configuration Schemas', () => {
    it('should validate CreateFacebookChannelInputSchema and FacebookChannelSchema', () => {
      const input = {
        pageId: 'page_1234567890',
        pageAccessToken: 'EAAXxX...',
      }
      expect(CreateFacebookChannelInputSchema.safeParse(input).success).toBe(true)

      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174033',
        pageId: 'page_1234567890',
        pageAccessTokenEncrypted: 'enc:v1:fb...',
        createdAt: '2026-10-10T10:00:00Z',
        updatedAt: '2026-10-10T10:00:00Z',
      }
      expect(FacebookChannelSchema.safeParse(entity).success).toBe(true)
    })

    it('should validate CreateInstagramChannelInputSchema and InstagramChannelSchema', () => {
      const input = {
        igUserId: 'ig_9876543210',
        igAccessToken: 'EAAXxX_IG...',
      }
      expect(CreateInstagramChannelInputSchema.safeParse(input).success).toBe(true)

      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174044',
        igUserId: 'ig_9876543210',
        igAccessTokenEncrypted: 'enc:v1:ig...',
        createdAt: '2026-10-10T10:00:00Z',
        updatedAt: '2026-10-10T10:00:00Z',
      }
      expect(InstagramChannelSchema.safeParse(entity).success).toBe(true)
    })
  })

  describe('SMS Channel Configuration Schemas', () => {
    it('should validate CreateSmsChannelInputSchema with default provider twilio', () => {
      const input = {
        accountSid: 'mock_sms_account_sid_9988',
        authToken: 'secret_twilio_token',
        fromPhoneNumber: '+1234567890',
      }

      const result = CreateSmsChannelInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.providerName).toBe('twilio')
      }
    })

    it('should validate persisted SmsChannelSchema', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174055',
        providerName: 'twilio',
        accountSid: 'mock_sms_account_sid_9988',
        authTokenEncrypted: 'enc:v1:sms...',
        fromPhoneNumber: '+1234567890',
        createdAt: '2026-10-10T10:00:00Z',
        updatedAt: '2026-10-10T10:00:00Z',
      }
      expect(SmsChannelSchema.safeParse(entity).success).toBe(true)
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT accept or require account_id in any channel schema', () => {
      expect(CreateEmailChannelInputSchema.shape).not.toHaveProperty('accountId')
      expect(CreateEmailChannelInputSchema.shape).not.toHaveProperty('account_id')
      expect(CreateTelegramChannelInputSchema.shape).not.toHaveProperty('accountId')
      expect(CreateFacebookChannelInputSchema.shape).not.toHaveProperty('accountId')
      expect(CreateInstagramChannelInputSchema.shape).not.toHaveProperty('accountId')
      expect(CreateSmsChannelInputSchema.shape).not.toHaveProperty('accountId')
    })

    it('should verify Phase 3 checklist marks Task 3.4 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 3.4**: Skema validasi konfigurasi masing-masing channel',
      )
    })
  })
})
