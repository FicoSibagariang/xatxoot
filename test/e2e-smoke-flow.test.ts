import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import app from '../apps/api/src/index'
import {
  assignmentService,
  resetAssignmentStore,
} from '../apps/api/src/modules/assignment/assignment.service'
import { resetAuthStore } from '../apps/api/src/modules/auth/auth.service'
import {
  conversationService,
  resetConversationStore,
} from '../apps/api/src/modules/conversations/conversations.service'
import { resetCopilotStore } from '../apps/api/src/modules/copilot/copilot.service'
import { csatService, resetCsatStore } from '../apps/api/src/modules/csat/csat.service'
import { resetInboxStore } from '../apps/api/src/modules/inboxes/inboxes.service'
import {
  messageService,
  resetMessageStore,
} from '../apps/api/src/modules/messages/messages.service'
import { resetTicketStore, ticketService } from '../apps/api/src/modules/tickets/tickets.service'

describe('End-to-End (E2E) Smoke Testing Suite — Critical User Journeys (Issue #265)', () => {
  const rootDir = join(import.meta.dir, '..')
  let ownerAccessToken = ''
  let ownerUserId = ''
  let waInboxId = ''
  let testConversationId = ''
  let testTicketId = ''
  let testContactId = ''
  let csatInviteToken = ''
  let setupResponseData: {
    organization?: Record<string, unknown>
    user?: Record<string, unknown>
  } = {}

  describe('1. Inisialisasi Organisasi & Autentikasi Pengguna', () => {
    it('should setup initial organization singleton and owner account via POST /api/v1/auth/setup', async () => {
      resetAuthStore()
      resetInboxStore()
      resetConversationStore()
      resetMessageStore()
      resetTicketStore()
      resetAssignmentStore()
      resetCsatStore()
      resetCopilotStore()

      const res = await app.request('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Xatxoot Corporation',
          adminName: 'Super Owner',
          adminEmail: 'owner@xatxoot.corp',
          adminPassword: 'SuperSecretPassword123!',
          timezone: 'Asia/Jakarta',
          defaultLocale: 'id',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      setupResponseData = data
      expect(data.organization).toBeDefined()
      expect(data.organization.name).toBe('Xatxoot Corporation')
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('owner@xatxoot.corp')
      expect(data.user.role).toBe('owner')
      expect(data.tokens).toBeDefined()
      expect(data.tokens.accessToken).toBeDefined()

      ownerAccessToken = data.tokens.accessToken
      ownerUserId = data.user.id
    })

    it('should strictly reject second setup attempt with 400/409 (Singleton Guardrail)', async () => {
      const res = await app.request('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Second Org Attempt',
          adminName: 'Attacker Admin',
          adminEmail: 'attacker@xatxoot.corp',
          adminPassword: 'AnotherPassword123!',
        }),
      })

      expect([400, 409]).toContain(res.status)
    })

    it('should login owner successfully and verify token on GET /api/v1/auth/me', async () => {
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'owner@xatxoot.corp',
          password: 'SuperSecretPassword123!',
        }),
      })

      expect(loginRes.status).toBe(200)
      const loginData = await loginRes.json()
      expect(loginData.tokens.accessToken).toBeDefined()
      ownerAccessToken = loginData.tokens.accessToken

      const meRes = await app.request('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${ownerAccessToken}`,
        },
      })

      expect(meRes.status).toBe(200)
      const meData = await meRes.json()
      expect(meData.user).toBeDefined()
      expect(meData.user.email).toBe('owner@xatxoot.corp')
      expect(meData.user.role).toBe('owner')
    })
  })

  describe('2. Provisi Inbox & Konfigurasi Tim', () => {
    it('should create WhatsApp Cloud API and Live Chat Web inboxes via POST /api/v1/inboxes', async () => {
      // 1. WhatsApp Cloud Inbox with full channel credentials
      const waRes = await app.request('/api/v1/inboxes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'WhatsApp Official Care',
          channelType: 'whatsapp_cloud',
          greetingEnabled: true,
          greetingMessage: 'Halo! Selamat datang di layanan pelanggan Xatxoot.',
          channel: {
            phoneNumber: '+62811223344',
            phoneNumberId: '109922334455667',
            wabaId: 'waba_id_889900',
            accessToken: 'meta_permanent_token_xyz',
            webhookVerifyToken: 'meta_verify_token_123',
          },
        }),
      })

      expect(waRes.status).toBe(201)
      const waData = await waRes.json()
      expect(waData.inbox).toBeDefined()
      expect(waData.inbox.channelType).toBe('whatsapp_cloud')
      waInboxId = waData.inbox.id

      // 2. Web Widget Inbox
      const webRes = await app.request('/api/v1/inboxes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Website Live Chat',
          channelType: 'web_widget',
          widgetColor: '#25D366',
        }),
      })

      expect(webRes.status).toBe(201)
      const webData = await webRes.json()
      expect(webData.inbox.channelType).toBe('web_widget')
    })

    it('should configure agent pool and set agent availability to online', async () => {
      await assignmentService.registerAgent({
        id: ownerUserId,
        email: 'owner@xatxoot.corp',
        displayName: 'Super Owner',
        role: 'owner',
        availability: 'online',
      })
      await assignmentService.setUserAvailability(ownerUserId, 'online')
      await assignmentService.addInboxMember(waInboxId, ownerUserId)

      const agent = await assignmentService.getAgent(ownerUserId)
      expect(agent?.availability).toBe('online')
    })
  })

  describe('3. Simulasi Pesan Masuk Pelanggan & FSM Tiket Otomatis', () => {
    it('should simulate inbound customer message and automatically create Contact, Conversation, and open Ticket', async () => {
      const inboundPayload = {
        inboxId: waInboxId,
        sourceId: '+6281234567890',
        content: 'Halo CS, paket kiriman pesanan #ORD-9988 saya belum sampai, mohon dicek ya.',
        senderName: 'Budi Santoso',
      }

      const result = await conversationService.handleInboundMessage(inboundPayload)

      expect(result).toBeDefined()
      expect(result.conversation).toBeDefined()
      expect(result.ticket).toBeDefined()
      expect(result.ticket.status).toBe('open')
      expect(result.message).toBeDefined()
      expect(result.message.content).toContain('#ORD-9988')

      testConversationId = result.conversation.id
      testTicketId = result.ticket.id
      testContactId = result.conversation.contactId

      // Auto-assign ticket to online agent
      const assigned = await assignmentService.assignTicketRoundRobin(testTicketId, {
        inboxId: waInboxId,
      })
      expect(assigned.success).toBe(true)
      expect(assigned.assignedAgentId).toBe(ownerUserId)
    })
  })

  describe('4. Respons Agen & Kolaborasi AI Copilot', () => {
    it('should retrieve conversation messages thread via GET /api/v1/conversations/:id/messages', async () => {
      const res = await app.request(`/api/v1/conversations/${testConversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${ownerAccessToken}`,
        },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(1)
      expect(data[0].content).toContain('#ORD-9988')
    })

    it('should execute AI Copilot action to generate polite draft reply', async () => {
      const res = await app.request('/api/v1/copilot/action', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'draft_reply',
          customerQuery:
            'Halo CS, paket kiriman pesanan #ORD-9988 saya belum sampai, mohon dicek ya.',
          conversationId: testConversationId,
          tone: 'polite',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.data.action).toBe('draft_reply')
      expect(data.data.result).toBeDefined()
      expect(typeof data.data.result).toBe('string')
      expect(data.data.result.length).toBeGreaterThan(10)
    })

    it('should send agent outgoing response message via POST /api/v1/conversations/:id/messages', async () => {
      const res = await app.request(`/api/v1/conversations/${testConversationId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content:
            'Halo Kak Budi, pesanan #ORD-9988 sedang dalam proses pengantaran oleh kurir menuju alamat Anda.',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.message).toBeDefined()
      expect(data.message.messageType).toBe('outgoing')
      expect(data.message.content).toContain('kurir')
    })
  })

  describe('5. Siklus Penutupan Tiket, Survei CSAT, & Pelaporan Analitik', () => {
    it('should resolve ticket status via PATCH /api/v1/tickets/:id/status', async () => {
      const res = await app.request(`/api/v1/tickets/${testTicketId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'resolved',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ticket).toBeDefined()
      expect(data.ticket.status).toBe('resolved')
    })

    it('should generate CSAT survey invite upon resolution and verify public survey submission', async () => {
      const invite = await csatService.createInvite({
        ticketId: testTicketId,
        contactId: testContactId,
      })

      expect(invite).toBeDefined()
      expect(invite.token).toBeDefined()
      expect(invite.status).toBe('pending')
      csatInviteToken = invite.token

      // 1. Customer retrieves public survey
      const getRes = await app.request(`/api/v1/csat/${csatInviteToken}`)
      expect(getRes.status).toBe(200)
      const surveyData = await getRes.json()
      expect(surveyData.ok).toBe(true)
      expect(surveyData.data).toBeDefined()
      expect(surveyData.data.status).toBe('pending')

      // 2. Customer submits rating & feedback
      const submitRes = await app.request(`/api/v1/csat/${csatInviteToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          feedbackText: 'Pelayanan sangat ramah, cepat tanggap, dan solutif!',
        }),
      })

      expect(submitRes.status).toBe(200)
      const submitData = await submitRes.json()
      expect(submitData.ok).toBe(true)
      expect(submitData.data).toBeDefined()
      expect(submitData.data.rating).toBe(5)
    })

    it('should record CSAT metrics accurately via GET /api/v1/csat/metrics', async () => {
      const res = await app.request('/api/v1/csat/metrics')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.data.totalSurveys).toBeGreaterThanOrEqual(1)
      expect(data.data.csatScorePercentage).toBeGreaterThanOrEqual(80)
    })
  })

  describe('6. Root package.json Script & Single Organization Guardrail', () => {
    it('should verify test:e2e script is present in root package.json', () => {
      const pkgRaw = readFileSync(join(rootDir, 'package.json'), 'utf-8')
      const pkg = JSON.parse(pkgRaw)
      expect(pkg.scripts['test:e2e']).toBe('bun test test/e2e-smoke-flow.test.ts')
    })

    it('should verify response payloads never expose multi-tenant account identifiers', () => {
      expect(setupResponseData.organization.accountId).toBeUndefined()
      expect(setupResponseData.organization.account_id).toBeUndefined()
      expect(setupResponseData.user.accountId).toBeUndefined()
      expect(setupResponseData.user.account_id).toBeUndefined()
    })
  })
})
