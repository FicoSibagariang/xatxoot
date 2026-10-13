import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { assignmentService, resetAssignmentStore } from '../assignment/assignment.service'
import { type RealtimeEvent, realtimeService } from '../realtime/realtime.service'
import { resetTicketStore, ticketService } from '../tickets/tickets.service'
import { capacityRoutes } from './capacity.routes'
import { CapacityPolicyService, capacityService, resetCapacityStore } from './capacity.service'

describe('Capacity Policy Engine (Task 5.13 - apps/api)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  const validInboxId = '123e4567-e89b-12d3-a456-426614174001'

  let app: Hono
  let capturedEvents: RealtimeEvent[] = []

  beforeEach(async () => {
    resetCapacityStore()
    resetAssignmentStore()
    resetTicketStore()
    capturedEvents = []

    const originalBroadcast = realtimeService.broadcast.bind(realtimeService)
    realtimeService.broadcast = (event: RealtimeEvent) => {
      capturedEvents.push(event)
      originalBroadcast(event)
    }

    app = new Hono()
    app.route('/api/v1/capacity', capacityRoutes)
  })

  describe('1. Capacity Policy Management (CRUD)', () => {
    it('should create and retrieve a capacity policy', async () => {
      const created = await capacityService.createPolicy({
        name: 'Standard 10-Ticket Limit',
        description: 'Batas penanganan maksimal 10 tiket aktif',
        maxActiveTickets: 10,
        inboxId: validInboxId,
        excludeSnoozed: false,
        active: true,
      })

      expect(created.id).toBeDefined()
      expect(created.name).toBe('Standard 10-Ticket Limit')
      expect(created.maxActiveTickets).toBe(10)
      expect(created.inboxId).toBe(validInboxId)
      expect(created.active).toBe(true)

      const fetched = await capacityService.getPolicyById(created.id)
      expect(fetched).not.toBeNull()
      expect(fetched?.name).toBe('Standard 10-Ticket Limit')
    })

    it('should support global default capacity policy when inboxId is null', async () => {
      const globalPolicy = await capacityService.createPolicy({
        name: 'Global Default Capacity',
        maxActiveTickets: 8,
      })

      expect(globalPolicy.inboxId).toBeNull()

      const effective = await capacityService.getEffectivePolicyForInbox('any-inbox-id')
      expect(effective).not.toBeNull()
      expect(effective?.id).toBe(globalPolicy.id)
      expect(effective?.maxActiveTickets).toBe(8)
    })

    it('should update and delete capacity policies', async () => {
      const policy = await capacityService.createPolicy({
        name: 'Temporary Policy',
        maxActiveTickets: 5,
      })

      const updated = await capacityService.updatePolicy(policy.id, {
        name: 'Updated Policy',
        maxActiveTickets: 12,
        active: false,
      })

      expect(updated.name).toBe('Updated Policy')
      expect(updated.maxActiveTickets).toBe(12)
      expect(updated.active).toBe(false)

      const deleted = await capacityService.deletePolicy(policy.id)
      expect(deleted).toBe(true)

      const fetched = await capacityService.getPolicyById(policy.id)
      expect(fetched).toBeNull()
    })
  })

  describe('2. Agent Capacity Overrides & Leave Management', () => {
    it('should allow setting custom capacity limit per agent', async () => {
      const agentId = crypto.randomUUID()
      const override = await capacityService.setAgentOverride(agentId, {
        maxActiveTickets: 15, // Senior agent capacity
      })

      expect(override.userId).toBe(agentId)
      expect(override.maxActiveTickets).toBe(15)
      expect(override.onLeave).toBe(false)

      const status = await capacityService.getAgentCapacity(agentId)
      expect(status.maxCapacity).toBe(15)
    })

    it('should prevent ticket assignment when agent is on leave', async () => {
      const agentId = crypto.randomUUID()
      await capacityService.setAgentOverride(agentId, {
        onLeave: true,
        leaveReason: 'Annual Vacation',
      })

      const status = await capacityService.getAgentCapacity(agentId)
      expect(status.onLeave).toBe(true)
      expect(status.maxCapacity).toBe(0)
      expect(status.availableCapacity).toBe(0)
      expect(status.isFull).toBe(true)

      const canAssign = await capacityService.canAssignTicket(agentId)
      expect(canAssign.allowed).toBe(false)
      expect(canAssign.reason).toBe('agent_on_leave')
    })
  })

  describe('3. Workload Calculation & Capacity Guard (canAssignTicket)', () => {
    it('should accurately calculate active ticket count excluding resolved tickets', async () => {
      const agentId = crypto.randomUUID()

      // Create 2 open tickets and 1 resolved ticket for this agent
      await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        assigneeId: agentId,
        status: 'open',
      })
      await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        assigneeId: agentId,
        status: 'pending',
      })
      await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        assigneeId: agentId,
        status: 'resolved',
      })

      const activeCount = await capacityService.getActiveTicketCount(agentId)
      expect(activeCount).toBe(2)
    })

    it('should reject assignment when agent has reached maximum capacity', async () => {
      const agentId = crypto.randomUUID()

      // Policy with limit of 2 tickets
      await capacityService.createPolicy({
        name: 'Strict 2 Limit',
        maxActiveTickets: 2,
      })

      // Assign 2 active tickets
      await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        assigneeId: agentId,
        status: 'open',
      })
      await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        assigneeId: agentId,
        status: 'open',
      })

      const status = await capacityService.getAgentCapacity(agentId)
      expect(status.activeCount).toBe(2)
      expect(status.maxCapacity).toBe(2)
      expect(status.availableCapacity).toBe(0)
      expect(status.isFull).toBe(true)

      const check = await capacityService.canAssignTicket(agentId)
      expect(check.allowed).toBe(false)
      expect(check.reason).toBe('agent_at_maximum_capacity')
    })

    it('should exclude snoozed tickets from capacity calculation if configured', async () => {
      const agentId = crypto.randomUUID()

      await capacityService.createPolicy({
        name: 'Exclude Snoozed Policy',
        maxActiveTickets: 5,
        excludeSnoozed: true,
      })

      await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        assigneeId: agentId,
        status: 'open',
      })
      await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        assigneeId: agentId,
        status: 'snoozed',
      })

      const count = await capacityService.getActiveTicketCount(agentId, {
        excludeSnoozed: true,
      })
      expect(count).toBe(1)
    })
  })

  describe('4. Round-Robin Integration & Capacity Enforcement', () => {
    it('should skip agent who reached max capacity and assign to next eligible agent', async () => {
      // Setup policy: 1 ticket per agent
      await capacityService.createPolicy({
        name: 'Single Ticket Limit',
        inboxId: validInboxId,
        maxActiveTickets: 1,
      })

      const agent1Id = 'agent-1111-1111-1111'
      const agent2Id = 'agent-2222-2222-2222'

      await assignmentService.registerAgent({ id: agent1Id, availability: 'online', active: true })
      await assignmentService.registerAgent({ id: agent2Id, availability: 'online', active: true })
      await assignmentService.addInboxMember(validInboxId, agent1Id)
      await assignmentService.addInboxMember(validInboxId, agent2Id)

      // Agent 1 already has 1 active ticket (full)
      await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        assigneeId: agent1Id,
        status: 'open',
      })

      // New ticket needs assignment
      const newTicket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
      })

      const result = await assignmentService.assignTicketRoundRobin(newTicket.id, {
        inboxId: validInboxId,
      })

      expect(result.success).toBe(true)
      // Agent 1 was at capacity, so Agent 2 received the ticket
      expect(result.assignedAgentId).toBe(agent2Id)
    })

    it('should fail assignment with all_agents_at_capacity when all pool agents are full', async () => {
      await capacityService.createPolicy({
        name: 'Zero Available Policy',
        inboxId: validInboxId,
        maxActiveTickets: 1,
      })

      const agentId = 'agent-single-full'
      await assignmentService.registerAgent({ id: agentId, availability: 'online', active: true })
      await assignmentService.addInboxMember(validInboxId, agentId)

      // Agent already has 1 active ticket
      await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        assigneeId: agentId,
        status: 'open',
      })

      const unassignedTicket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
      })

      const result = await assignmentService.assignTicketRoundRobin(unassignedTicket.id, {
        inboxId: validInboxId,
      })

      expect(result.success).toBe(false)
      expect(result.reason).toBe('all_agents_at_capacity')
      expect(result.assignedAgentId).toBeNull()
    })
  })

  describe('5. REST API Endpoints (/api/v1/capacity)', () => {
    it('POST & GET /api/v1/capacity/policies should manage policies via HTTP', async () => {
      const createRes = await app.request('/api/v1/capacity/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'REST Capacity Policy',
          maxActiveTickets: 10,
        }),
      })

      expect(createRes.status).toBe(201)
      const created = await createRes.json()
      expect(created.id).toBeDefined()
      expect(created.maxActiveTickets).toBe(10)

      const listRes = await app.request('/api/v1/capacity/policies')
      expect(listRes.status).toBe(200)
      const list = await listRes.json()
      expect(list.some((p: Record<string, unknown>) => p.id === created.id)).toBe(true)
    })

    it('GET & POST /api/v1/capacity/agents/:agentId should query and set agent capacity override', async () => {
      const agentId = crypto.randomUUID()

      const overrideRes = await app.request(`/api/v1/capacity/agents/${agentId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxActiveTickets: 12,
          onLeave: false,
        }),
      })

      expect(overrideRes.status).toBe(200)
      const overrideData = await overrideRes.json()
      expect(overrideData.maxActiveTickets).toBe(12)

      const getRes = await app.request(`/api/v1/capacity/agents/${agentId}`)
      expect(getRes.status).toBe(200)
      const statusData = await getRes.json()
      expect(statusData.maxCapacity).toBe(12)
    })

    it('GET /api/v1/capacity/workload should return workload overview', async () => {
      const res = await app.request('/api/v1/capacity/workload')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('6. Single Organization Guardrail & Phase 5 Checklist', () => {
    it('should strictly NOT contain account_id or accountId in capacity models', async () => {
      const policy = await capacityService.createPolicy({
        name: 'Guardrail Policy',
        maxActiveTickets: 10,
      })

      const keys = Object.keys(policy)
      expect(keys).not.toContain('account_id')
      expect(keys).not.toContain('accountId')
    })

    it('should verify docs/PHASE_5_CHECKLIST.md marks Task 5.13 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 5.13 (TDD - Capacity Policy Engine)**:')
    })
  })
})
