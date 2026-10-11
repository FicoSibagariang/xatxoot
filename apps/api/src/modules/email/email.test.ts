import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EmailSenderService,
  EmailService,
  extractEmailAddress,
  extractTicketIdentifier,
  parseInboundEmail,
  stripEmailQuotes,
} from './email.service'

describe('Email Inbound Parser & Outbound Sender (Task 3.7 - apps/api)', () => {
  describe('Inbound Email Parser & Address Extraction', () => {
    it('should extract email address and display name correctly', () => {
      const parsed1 = extractEmailAddress('Budi Santoso <budi.santoso@example.com>')
      expect(parsed1.address).toBe('budi.santoso@example.com')
      expect(parsed1.name).toBe('Budi Santoso')

      const parsed2 = extractEmailAddress('support@perusahaan.co.id')
      expect(parsed2.address).toBe('support@perusahaan.co.id')
      expect(parsed2.name).toBeNull()

      const parsed3 = extractEmailAddress('"Customer Care" <care@brand.com>')
      expect(parsed3.address).toBe('care@brand.com')
      expect(parsed3.name).toBe('Customer Care')
    })

    it('should extract ticket identifier from subject if present', () => {
      expect(extractTicketIdentifier('Re: [Ticket #1055] Permintaan refund pesanan')).toBe('1055')
      expect(extractTicketIdentifier('RE: [TICKET-204] Pertanyaan status')).toBe('204')
      expect(extractTicketIdentifier('[#889] Tanya harga produk')).toBe('889')
      expect(extractTicketIdentifier('Halo min, mau tanya produk ready?')).toBeNull()
    })

    it('should parse inbound email payload correctly', () => {
      const rawPayload = {
        from: 'Pelanggan Setia <pelanggan@example.com>',
        to: 'support@xatxoot.com',
        subject: 'Re: Pertanyaan Layanan',
        text: 'Ini respon balasan saya.\n\nOn Wed, Oct 11, 2026 at 10:00 AM Support <support@xatxoot.com> wrote:\n> Ada yang bisa kami bantu?',
        html: '<p>Ini respon balasan saya.</p><div class="gmail_quote">On Wed, Oct 11, 2026 at 10:00 AM Support wrote:<br>Ada yang bisa kami bantu?</div>',
        messageId: '<msg-12345@example.com>',
        inReplyTo: '<prev-support-msg@xatxoot.com>',
        references: ['<root-msg@xatxoot.com>', '<prev-support-msg@xatxoot.com>'],
        date: '2026-10-11T10:30:00Z',
      }

      const parsed = parseInboundEmail(rawPayload)
      expect(parsed.from.address).toBe('pelanggan@example.com')
      expect(parsed.from.name).toBe('Pelanggan Setia')
      expect(parsed.to).toBe('support@xatxoot.com')
      expect(parsed.subject).toBe('Re: Pertanyaan Layanan')
      expect(parsed.messageId).toBe('<msg-12345@example.com>')
      expect(parsed.inReplyTo).toBe('<prev-support-msg@xatxoot.com>')
      expect(parsed.references).toEqual([
        '<root-msg@xatxoot.com>',
        '<prev-support-msg@xatxoot.com>',
      ])
      expect(parsed.cleanedText).toBe('Ini respon balasan saya.')
    })
  })

  describe('Quote Stripping (stripEmailQuotes)', () => {
    it('should strip standard "On [date], [author] wrote:" reply headers and quoted lines', () => {
      const bodyWithQuote = [
        'Terima kasih solusinya!',
        'Sekarang sudah berfungsi dengan baik.',
        '',
        'On Wed, Oct 11, 2026 at 09:15 AM Agent <agent@xatxoot.com> wrote:',
        '> Silakan restart aplikasi dan bersihkan cache browser.',
        '> Lalu login kembali dengan akun terdaftar.',
      ].join('\n')

      const cleaned = stripEmailQuotes(bodyWithQuote)
      expect(cleaned).toBe('Terima kasih solusinya!\nSekarang sudah berfungsi dengan baik.')
    })

    it('should strip Indonesian format "Pada tanggal ..., ... menulis:" reply header', () => {
      const body = [
        'Baik kak, nanti kami coba lagi.',
        '',
        'Pada tanggal 11 Okt 2026 14.30, CS Xatxoot <cs@xatxoot.com> menulis:',
        '> Halo kak, apakah kendala login masih berlanjut?',
      ].join('\n')

      const cleaned = stripEmailQuotes(body)
      expect(cleaned).toBe('Baik kak, nanti kami coba lagi.')
    })

    it('should strip Outlook style "-----Original Message-----" and horizontal rules', () => {
      const body = [
        'Mohon bantuan update tiket ini.',
        '',
        '-----Original Message-----',
        'From: Support Team [mailto:support@xatxoot.com]',
        'Sent: Tuesday, October 10, 2026 4:00 PM',
        'To: customer@example.com',
        'Subject: Informasi Tiket #12',
        '',
        'Tiket Anda telah dibuat.',
      ].join('\n')

      const cleaned = stripEmailQuotes(body)
      expect(cleaned).toBe('Mohon bantuan update tiket ini.')
    })

    it('should strip quote lines starting with > even without a header line', () => {
      const body = [
        'Jawaban baru saya ada di sini.',
        '',
        '> pesan lama baris 1',
        '> pesan lama baris 2',
      ].join('\n')

      const cleaned = stripEmailQuotes(body)
      expect(cleaned).toBe('Jawaban baru saya ada di sini.')
    })

    it('should strip HTML quote containers (.gmail_quote, blockquote)', () => {
      const htmlBody =
        '<div>Pesan balasan pelanggan baru</div><div class="gmail_quote"><blockquote>Kutipan email lama</blockquote></div>'
      const cleaned = stripEmailQuotes(htmlBody, { isHtml: true })
      expect(cleaned).not.toContain('Kutipan email lama')
      expect(cleaned).toContain('Pesan balasan pelanggan baru')
    })
  })

  describe('Outbound Email Sender (EmailSenderService)', () => {
    it('should construct correct email payload with In-Reply-To and References headers', async () => {
      const sentMails: Record<string, unknown>[] = []
      const mockTransporter = {
        sendMail: async (mailOptions: Record<string, unknown>) => {
          sentMails.push(mailOptions)
          return { messageId: '<generated-id@xatxoot.com>', response: '250 OK' }
        },
      }

      const senderService = new EmailSenderService({
        transporter: mockTransporter,
        defaultFrom: 'Support Xatxoot <support@xatxoot.com>',
      })

      const sendResult = await senderService.sendEmail({
        to: 'customer@example.com',
        subject: 'Re: [Ticket #101] Masalah Pembayaran',
        text: 'Halo, kendala pembayaran Anda sudah kami selesaikan.',
        html: '<p>Halo, kendala pembayaran Anda sudah kami selesaikan.</p>',
        inReplyTo: '<customer-msg-001@example.com>',
        references: ['<root-msg-000@example.com>', '<customer-msg-001@example.com>'],
      })

      expect(sendResult.success).toBe(true)
      expect(sentMails.length).toBe(1)

      const dispatched = sentMails[0]
      expect(dispatched.to).toBe('customer@example.com')
      expect(dispatched.from).toBe('Support Xatxoot <support@xatxoot.com>')
      expect(dispatched.subject).toBe('Re: [Ticket #101] Masalah Pembayaran')
      expect(dispatched.inReplyTo).toBe('<customer-msg-001@example.com>')
      expect(dispatched.references).toBe(
        '<root-msg-000@example.com> <customer-msg-001@example.com>',
      )
      const headers = dispatched.headers as Record<string, string>
      expect(headers['In-Reply-To']).toBe('<customer-msg-001@example.com>')
      expect(headers.References).toBe('<root-msg-000@example.com> <customer-msg-001@example.com>')
    })

    it('should append previous inReplyTo to references if references is empty', async () => {
      const sentMails: Record<string, unknown>[] = []
      const mockTransporter = {
        sendMail: async (mailOptions: Record<string, unknown>) => {
          sentMails.push(mailOptions)
          return { messageId: '<generated-id@xatxoot.com>', response: '250 OK' }
        },
      }

      const senderService = new EmailSenderService({
        transporter: mockTransporter,
        defaultFrom: 'support@xatxoot.com',
      })

      await senderService.sendEmail({
        to: 'customer@example.com',
        subject: 'Re: Pertanyaan',
        text: 'Balasan pesan.',
        inReplyTo: '<incoming-id-777@example.com>',
      })

      expect(sentMails[0].inReplyTo).toBe('<incoming-id-777@example.com>')
      expect(sentMails[0].references).toBe('<incoming-id-777@example.com>')
    })

    it('should generate valid Message-ID header if not provided', async () => {
      const sentMails: Record<string, unknown>[] = []
      const mockTransporter = {
        sendMail: async (mailOptions: Record<string, unknown>) => {
          sentMails.push(mailOptions)
          return {
            messageId: (mailOptions.messageId as string) || '<msg-id@xatxoot.com>',
          }
        },
      }

      const senderService = new EmailSenderService({
        transporter: mockTransporter,
        defaultFrom: 'support@xatxoot.com',
      })

      const res = await senderService.sendEmail({
        to: 'user@example.com',
        subject: 'Pemberitahuan',
        text: 'Halo user.',
      })

      expect(res.messageId).toBeDefined()
      expect(sentMails[0].messageId).toMatch(/^<.+@.+>$/)
    })

    it('should handle transporter error gracefully without unhandled exceptions', async () => {
      const failingTransporter = {
        sendMail: async () => {
          throw new Error('SMTP connection refused on port 587')
        },
      }

      const senderService = new EmailSenderService({
        transporter: failingTransporter,
        defaultFrom: 'support@xatxoot.com',
      })

      const result = await senderService.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        text: 'Error test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('SMTP connection refused on port 587')
    })
  })

  describe('EmailService Orchestration', () => {
    it('should process inbound email and prepare conversation message structure', async () => {
      const emailService = new EmailService()
      const result = await emailService.processInboundEmail({
        from: 'Andi <andi@example.com>',
        to: 'support@xatxoot.com',
        subject: 'Pertanyaan Pesanan #401',
        text: 'Apakah pesanan saya sudah dikirim?\n\nOn Wed, Oct 11, 2026: Agent wrote:\n> Halo',
        messageId: '<inbound-andi-01@example.com>',
        inReplyTo: '<initial-bot@xatxoot.com>',
      })

      expect(result.senderEmail).toBe('andi@example.com')
      expect(result.senderName).toBe('Andi')
      expect(result.cleanedContent).toBe('Apakah pesanan saya sudah dikirim?')
      expect(result.messageId).toBe('<inbound-andi-01@example.com>')
      expect(result.inReplyTo).toBe('<initial-bot@xatxoot.com>')
      expect(result.contentType).toBe('incoming_email')
    })
  })

  describe('Email HTTP Routes (apps/api)', () => {
    it('should handle POST /api/v1/email/inbound successfully', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/email/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Client <client@example.com>',
          to: 'support@xatxoot.com',
          subject: 'Pertanyaan Webhook',
          text: 'Pesan melalui email webhook.\n\nOn Wed: Agent wrote:\n> Halo',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('success')
      expect(data.data.senderEmail).toBe('client@example.com')
      expect(data.data.cleanedContent).toBe('Pesan melalui email webhook.')
    })

    it('should reject POST /api/v1/email/inbound with 400 when missing required fields', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/email/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'client@example.com',
          // missing to and subject
        }),
      })

      expect(response.status).toBe(400)
    })

    it('should handle POST /api/v1/email/outbound successfully', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/email/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'client@example.com',
          subject: 'Balasan Customer Care',
          text: 'Ini pesan jawaban agent.',
          inReplyTo: '<client-msg@example.com>',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('success')
      expect(data.data.success).toBe(true)
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should not contain or require account_id anywhere in email service payload', async () => {
      const emailService = new EmailService()
      const result = await emailService.processInboundEmail({
        from: 'user@example.com',
        to: 'support@xatxoot.com',
        subject: 'Test Org',
        text: 'Halo',
      })

      expect(result).not.toHaveProperty('accountId')
      expect(result).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.7 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 3.7 (TDD - Email)**:')
    })
  })
})
