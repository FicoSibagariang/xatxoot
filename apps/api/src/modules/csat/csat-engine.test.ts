import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CsatEngine, CsatService, resetCsatStore } from './csat.service'

describe('CSAT Engine & Public Survey Endpoint (Task 3.12 - apps/api)', () => {
  const dummyTicketId = '123e4567-e89b-12d3-a456-426614174001'
  const dummyContactId = '123e4567-e89b-12d3-a456-426614174002'
  const dummyConversationId = '123e4567-e89b-12d3-a456-426614174003'

  beforeEach(() => {
    resetCsatStore()
  })

  describe('CSAT Invite Generation upon Ticket Resolution', () => {
    it('should create a new CSAT invite when ticket is resolved', async () => {
      const csatService = new CsatService()
      const invite = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })

      expect(invite).toBeDefined()
      expect(invite.ticketId).toBe(dummyTicketId)
      expect(invite.contactId).toBe(dummyContactId)
      expect(invite.token).toBeDefined()
      expect(invite.token.length).toBeGreaterThan(10)
      expect(invite.status).toBe('pending')
      expect(invite.inviteUrl).toContain(invite.token)
      expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now())
    })

    it('should be idempotent: return existing invite if ticket already has one', async () => {
      const csatService = new CsatService()
      const invite1 = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })
      const invite2 = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })

      expect(invite1.token).toBe(invite2.token)
      expect(invite1.id).toBe(invite2.id)
    })

    it('should retrieve invite by token and by ticketId', async () => {
      const csatService = new CsatService()
      const created = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })

      const byToken = await csatService.getInviteByToken(created.token)
      expect(byToken).not.toBeNull()
      expect(byToken?.ticketId).toBe(dummyTicketId)

      const byTicket = await csatService.getInviteByTicketId(dummyTicketId)
      expect(byTicket).not.toBeNull()
      expect(byTicket?.token).toBe(created.token)
    })

    it('should trigger CSAT invite automatically on ticket status update to resolved', async () => {
      const { ticketService } = await import('../tickets/tickets.service')
      const ticket = await ticketService.createTicket({
        conversationId: dummyConversationId,
        status: 'open',
        priority: 'medium',
      })

      // Update to pending -> no invite
      await ticketService.updateTicketStatus(ticket.id, 'pending')
      const csatService = new CsatService()
      let invite = await csatService.getInviteByTicketId(ticket.id)
      expect(invite).toBeNull()

      // Update to resolved -> invite created
      await ticketService.updateTicketStatus(ticket.id, 'resolved')
      invite = await csatService.getInviteByTicketId(ticket.id)
      expect(invite).not.toBeNull()
      expect(invite?.ticketId).toBe(ticket.id)
      expect(invite?.status).toBe('pending')
    })
  })

  describe('Public CSAT Survey Submission (POST /api/v1/csat/:ticket_token)', () => {
    it('should accept valid survey submission with rating and feedback', async () => {
      const { default: app } = await import('../../index')
      const csatService = new CsatService()
      const invite = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })

      const response = await app.request(`/api/v1/csat/${invite.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          feedbackText: 'Pelayanan sangat memuaskan dan responsif!',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
      expect(data.data.rating).toBe(5)
      expect(data.data.feedbackText).toBe('Pelayanan sangat memuaskan dan responsif!')
      expect(data.data.ticketId).toBe(dummyTicketId)

      // Invite status should transition to submitted
      const updatedInvite = await csatService.getInviteByToken(invite.token)
      expect(updatedInvite?.status).toBe('submitted')
    })

    it('should accept valid survey submission with rating only (feedbackText omitted)', async () => {
      const { default: app } = await import('../../index')
      const csatService = new CsatService()
      const freshTicketId = '123e4567-e89b-12d3-a456-426614174099'
      const invite = await csatService.createInvite({
        ticketId: freshTicketId,
        contactId: dummyContactId,
      })

      const response = await app.request(`/api/v1/csat/${invite.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 4,
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
      expect(data.data.rating).toBe(4)
      expect(data.data.ticketId).toBe(freshTicketId)
    })

    it('should reject invalid ratings (e.g. 0, 6, 3.5, string)', async () => {
      const { default: app } = await import('../../index')
      const csatService = new CsatService()
      const invite = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })

      // Rating = 0
      const res0 = await app.request(`/api/v1/csat/${invite.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 0 }),
      })
      expect(res0.status).toBe(400)

      // Rating = 6
      const res6 = await app.request(`/api/v1/csat/${invite.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 6 }),
      })
      expect(res6.status).toBe(400)

      // Rating = 3.5
      const resFloat = await app.request(`/api/v1/csat/${invite.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 3.5 }),
      })
      expect(resFloat.status).toBe(400)
    })

    it('should reject feedbackText exceeding 2000 characters', async () => {
      const { default: app } = await import('../../index')
      const csatService = new CsatService()
      const invite = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })

      const response = await app.request(`/api/v1/csat/${invite.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 4,
          feedbackText: 'x'.repeat(2001),
        }),
      })

      expect(response.status).toBe(400)
    })

    it('should return 404 when token does not exist', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/csat/non-existent-token-xyz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5 }),
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.ok).toBe(false)
    })

    it('should prevent duplicate submission for the same CSAT invite', async () => {
      const { default: app } = await import('../../index')
      const csatService = new CsatService()
      const invite = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })

      // First submission: Success
      const res1 = await app.request(`/api/v1/csat/${invite.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5, feedbackText: 'Pertama' }),
      })
      expect(res1.status).toBe(200)

      // Second submission: Conflict / Already submitted
      const res2 = await app.request(`/api/v1/csat/${invite.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 4, feedbackText: 'Kedua' }),
      })
      expect(res2.status).toBe(409)
      const data2 = await res2.json()
      expect(data2.ok).toBe(false)
    })

    it('should reject submission if token is expired', async () => {
      const { default: app } = await import('../../index')
      const csatService = new CsatService()
      const invite = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
        expiresInMs: -1000, // expired in the past
      })

      const response = await app.request(`/api/v1/csat/${invite.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5 }),
      })

      expect(response.status).toBe(410)
    })
  })

  describe('Public CSAT Survey Retrieval (GET /api/v1/csat/:ticket_token)', () => {
    it('should return survey invite details for valid token', async () => {
      const { default: app } = await import('../../index')
      const csatService = new CsatService()
      const invite = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })

      const response = await app.request(`/api/v1/csat/${invite.token}`)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
      expect(data.data.ticketId).toBe(dummyTicketId)
      expect(data.data.status).toBe('pending')
      expect(data.data.isSubmitted).toBe(false)
    })

    it('should return 404 for invalid token', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/csat/invalid-random-token')
      expect(response.status).toBe(404)
    })
  })

  describe('CSAT Metrics & Ticket Survey Retrieval', () => {
    it('should retrieve survey response by ticketId via service and HTTP endpoint', async () => {
      const { default: app } = await import('../../index')
      const csatService = new CsatService()
      const invite = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })
      await csatService.submitSurvey({
        token: invite.token,
        rating: 5,
        feedbackText: 'Hebat sekali!',
      })

      // Service lookup
      const survey = await csatService.getSurveyByTicketId(dummyTicketId)
      expect(survey).not.toBeNull()
      expect(survey?.rating).toBe(5)

      // HTTP endpoint
      const response = await app.request(`/api/v1/csat/tickets/${dummyTicketId}`)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
      expect(data.data.rating).toBe(5)
    })

    it('should calculate aggregate CSAT metrics matching CsatSurveyMetricsSchema', async () => {
      const { default: app } = await import('../../index')
      const csatService = new CsatService()

      // Submit multiple surveys
      for (const [idx, rating] of [5, 4, 5, 3, 5].entries()) {
        const ticketId = `123e4567-e89b-12d3-a456-4266141740${idx + 10}`
        const invite = await csatService.createInvite({ ticketId, contactId: dummyContactId })
        await csatService.submitSurvey({ token: invite.token, rating })
      }

      const metrics = await csatService.getMetrics()
      expect(metrics.totalSurveys).toBe(5)
      expect(metrics.averageRating).toBe(4.4)
      // CSAT percentage: count of (4 and 5) / total * 100 = 4 / 5 * 100 = 80%
      expect(metrics.csatScorePercentage).toBe(80)
      expect(metrics.ratingDistribution['5']).toBe(3)
      expect(metrics.ratingDistribution['4']).toBe(1)
      expect(metrics.ratingDistribution['3']).toBe(1)

      const response = await app.request('/api/v1/csat/metrics')
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
      expect(data.data.totalSurveys).toBe(5)
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in CSAT invite or survey structures', async () => {
      const csatService = new CsatService()
      const invite = await csatService.createInvite({
        ticketId: dummyTicketId,
        contactId: dummyContactId,
      })
      const survey = await csatService.submitSurvey({
        token: invite.token,
        rating: 5,
      })

      expect(invite).not.toHaveProperty('accountId')
      expect(invite).not.toHaveProperty('account_id')
      expect(survey).not.toHaveProperty('accountId')
      expect(survey).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.12 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 3.12 (TDD - CSAT Engine)**:')
    })
  })
})
