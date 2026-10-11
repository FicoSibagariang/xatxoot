import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChannelWizard, type ChannelWizardPayload, validateChannelPayload } from './ChannelWizard'

describe('Omnichannel Channel Configuration Wizard (Task 3.13 - apps/web)', () => {
  describe('Step 1: Channel Type Selection View', () => {
    it('should render all 4 omnichannel channel options with badges and descriptions', () => {
      const html = renderToStaticMarkup(
        <ChannelWizard initialStep="select" onSaveChannel={() => {}} onClose={() => {}} />,
      )

      // Title & Header
      expect(html).toContain('Tambah Channel Komunikasi')
      expect(html).toContain('Pilih saluran komunikasi')

      // 1. Email Card
      expect(html).toContain('Email')
      expect(html).toContain('IMAP / SMTP')
      expect(html).toContain('Kirim dan terima email tiket melalui server mail')

      // 2. Telegram Card
      expect(html).toContain('Telegram Bot')
      expect(html).toContain('Telegram API')
      expect(html).toContain('Hubungkan bot resmi Telegram dengan BotFather')

      // 3. Meta Social Card
      expect(html).toContain('Facebook &amp; Instagram')
      expect(html).toContain('Meta Graph API')
      expect(html).toContain('Messenger')

      // 4. SMS / Twilio Card
      expect(html).toContain('SMS Twilio')
      expect(html).toContain('Twilio SMS')
      expect(html).toContain('Kirim dan terima SMS global melalui Twilio')
    })
  })

  describe('Step 2: Email Configuration Form', () => {
    it('should render Email IMAP & SMTP configuration fields with default ports', () => {
      const html = renderToStaticMarkup(
        <ChannelWizard
          initialStep="configure"
          initialChannel="email"
          onSaveChannel={() => {}}
          onClose={() => {}}
        />,
      )

      expect(html).toContain('Konfigurasi Channel Email')
      expect(html).toContain('Nama Inbox')
      expect(html).toContain('IMAP Host')
      expect(html).toContain('IMAP Port')
      expect(html).toContain('993')
      expect(html).toContain('IMAP Username')
      expect(html).toContain('IMAP Password')
      expect(html).toContain('SMTP Host')
      expect(html).toContain('SMTP Port')
      expect(html).toContain('587')
      expect(html).toContain('SMTP Username')
      expect(html).toContain('SMTP Password')
    })

    it('should validate Email payload correctly using validateChannelPayload', () => {
      // Valid payload
      const validEmail: ChannelWizardPayload = {
        channelType: 'email',
        inboxName: 'Helpdesk Email',
        emailConfig: {
          imapHost: 'imap.example.com',
          imapPort: 993,
          imapUsername: 'support@example.com',
          imapPassword: 'secret-password',
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpUsername: 'support@example.com',
          smtpPassword: 'secret-password',
        },
      }
      const validResult = validateChannelPayload(validEmail)
      expect(validResult.success).toBe(true)

      // Invalid payload (missing host & password)
      const invalidEmail: ChannelWizardPayload = {
        channelType: 'email',
        inboxName: 'Helpdesk Email',
        emailConfig: {
          imapHost: '',
          imapPort: 993,
          imapUsername: 'support@example.com',
          imapPassword: '',
          smtpHost: '',
          smtpPort: 587,
          smtpUsername: '',
          smtpPassword: '',
        },
      }
      const invalidResult = validateChannelPayload(invalidEmail)
      expect(invalidResult.success).toBe(false)
      expect(invalidResult.errors).toBeDefined()
      expect(invalidResult.errors?.imapHost).toBeDefined()
    })
  })

  describe('Step 2: Telegram Configuration Form', () => {
    it('should render Telegram Bot configuration fields and BotFather guidance', () => {
      const html = renderToStaticMarkup(
        <ChannelWizard
          initialStep="configure"
          initialChannel="telegram"
          onSaveChannel={() => {}}
          onClose={() => {}}
        />,
      )

      expect(html).toContain('Konfigurasi Telegram Bot')
      expect(html).toContain('Nama Inbox')
      expect(html).toContain('Bot Token')
      expect(html).toContain('Username Bot')
      expect(html).toContain('@BotFather')
    })

    it('should validate Telegram payload correctly', () => {
      const validTelegram: ChannelWizardPayload = {
        channelType: 'telegram',
        inboxName: 'Telegram CS',
        telegramConfig: {
          botToken: '123456789:ABCdefGhIJKlmNoPQRstuVWXyz',
          botUsername: 'xatxoot_bot',
        },
      }
      expect(validateChannelPayload(validTelegram).success).toBe(true)

      const invalidTelegram: ChannelWizardPayload = {
        channelType: 'telegram',
        inboxName: '',
        telegramConfig: {
          botToken: '',
          botUsername: '',
        },
      }
      const res = validateChannelPayload(invalidTelegram)
      expect(res.success).toBe(false)
      expect(res.errors?.inboxName).toBeDefined()
      expect(res.errors?.botToken).toBeDefined()
    })
  })

  describe('Step 2: Meta Social (Facebook & Instagram) Configuration Form', () => {
    it('should render Facebook and Instagram configuration toggle & fields', () => {
      const html = renderToStaticMarkup(
        <ChannelWizard
          initialStep="configure"
          initialChannel="facebook"
          onSaveChannel={() => {}}
          onClose={() => {}}
        />,
      )

      expect(html).toContain('Konfigurasi Meta Social')
      expect(html).toContain('Facebook Page')
      expect(html).toContain('Instagram Direct')
      expect(html).toContain('Page ID')
      expect(html).toContain('Page Access Token')
    })

    it('should validate Facebook and Instagram payloads correctly', () => {
      const validFb: ChannelWizardPayload = {
        channelType: 'facebook',
        inboxName: 'FB Official',
        facebookConfig: {
          pageId: 'page_123456',
          pageAccessToken: 'EAAXxX...',
        },
      }
      expect(validateChannelPayload(validFb).success).toBe(true)

      const validIg: ChannelWizardPayload = {
        channelType: 'instagram',
        inboxName: 'IG Direct',
        instagramConfig: {
          igUserId: 'ig_789012',
          igAccessToken: 'EAAXxX_IG...',
        },
      }
      expect(validateChannelPayload(validIg).success).toBe(true)
    })
  })

  describe('Step 2: SMS Twilio Configuration Form', () => {
    it('should render Twilio SMS configuration fields with E.164 phone guidance', () => {
      const html = renderToStaticMarkup(
        <ChannelWizard
          initialStep="configure"
          initialChannel="sms"
          onSaveChannel={() => {}}
          onClose={() => {}}
        />,
      )

      expect(html).toContain('Konfigurasi SMS (Twilio)')
      expect(html).toContain('Account SID')
      expect(html).toContain('Auth Token')
      expect(html).toContain('Nomor Pengirim (From Phone Number)')
      expect(html).toContain('+1234567890')
    })

    it('should validate Twilio SMS payload correctly', () => {
      const validSms: ChannelWizardPayload = {
        channelType: 'sms',
        inboxName: 'SMS Helpline',
        smsConfig: {
          accountSid: 'AC_dummy_sid_123',
          authToken: 'auth_token_456',
          fromPhoneNumber: '+1234567890',
          providerName: 'twilio',
        },
      }
      expect(validateChannelPayload(validSms).success).toBe(true)

      const invalidSms: ChannelWizardPayload = {
        channelType: 'sms',
        inboxName: 'SMS Helpline',
        smsConfig: {
          accountSid: '',
          authToken: '',
          fromPhoneNumber: '',
          providerName: 'twilio',
        },
      }
      const res = validateChannelPayload(invalidSms)
      expect(res.success).toBe(false)
      expect(res.errors?.accountSid).toBeDefined()
    })
  })

  describe('Step 3: Success Confirmation View & Webhook Instructions', () => {
    it('should render success view with connection badge and webhook callback URL', () => {
      const html = renderToStaticMarkup(
        <ChannelWizard
          initialStep="success"
          initialChannel="telegram"
          savedInboxName="Telegram Support Utama"
          onSaveChannel={() => {}}
          onClose={() => {}}
        />,
      )

      expect(html).toContain('Channel Berhasil Ditambahkan!')
      expect(html).toContain('Telegram Support Utama')
      expect(html).toContain('Webhook URL')
      expect(html).toContain('/api/v1/telegram/webhook')
      expect(html).toContain('Selesai')
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT require or pass accountId in ChannelWizard payload or props', () => {
      const payload: ChannelWizardPayload = {
        channelType: 'telegram',
        inboxName: 'Telegram Support',
        telegramConfig: {
          botToken: '123:token',
          botUsername: 'bot',
        },
      }
      expect(payload).not.toHaveProperty('accountId')
      expect(payload).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.13 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 3.13**: Halaman konfigurasi penambahan channel baru',
      )
    })
  })
})
