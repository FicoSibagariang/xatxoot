import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService, resetConversationStore } from '../conversations/conversations.service'
import { inboxService, resetInboxStore } from '../inboxes/inboxes.service'
import { resetTeamStore, teamService } from '../teams/teams.service'
import { resetTicketStore, ticketService } from '../tickets/tickets.service'
import {
  type AssignmentCandidate,
  assignmentService,
  resetAssignmentStore,
} from './assignment.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
  'Content-Type': 'application/json',
}

describe('Assignment Module - Auth Guards', () => {
  it('POST /api/v1/assignment/round-robin should reject requests without Authorization with 401', async () => {
    const res = await app.request('/api/v1/assignment/round-robin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: '00000000-0000-0000-0000-000000000001' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/tickets/:id/auto-assign should reject requests without Authorization with 401', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/tickets/${fakeId}/auto-assign`, {
      method: 'POST',
    })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/v1/assignment/users/:id/availability should reject requests without Authorization with 401', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/assignment/users/${fakeId}/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability: 'offline' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('Assignment Module - Round-Robin Engine (Core Logic)', () => {
  beforeEach(() => {
    resetAssignmentStore()
    resetTicketStore()
    resetConversationStore()
    resetInboxStore()
    resetTeamStore()
  })

  it('should rotate ticket assignment sequentially among online agents in an inbox', async () => {
    const inboxId = '11111111-1111-1111-1111-111111111111'
    const agentAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const agentBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const agentCId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

    // Register agents into memory/db
    await assignmentService.registerAgent({
      id: agentAId,
      email: 'agentA@acme.corp',
      displayName: 'Agent Alpha',
      role: 'agent',
      availability: 'online',
      active: true,
    })
    await assignmentService.registerAgent({
      id: agentBId,
      email: 'agentB@acme.corp',
      displayName: 'Agent Bravo',
      role: 'agent',
      availability: 'online',
      active: true,
    })
    await assignmentService.registerAgent({
      id: agentCId,
      email: 'agentC@acme.corp',
      displayName: 'Agent Charlie',
      role: 'agent',
      availability: 'online',
      active: true,
    })

    // Assign agents as inbox members
    await assignmentService.addInboxMember(inboxId, agentAId)
    await assignmentService.addInboxMember(inboxId, agentBId)
    await assignmentService.addInboxMember(inboxId, agentCId)

    // Create 4 tickets in this inbox
    const t1 = await ticketService.createTicket({ conversationId: 'conv-1' })
    const t2 = await ticketService.createTicket({ conversationId: 'conv-2' })
    const t3 = await ticketService.createTicket({ conversationId: 'conv-3' })
    const t4 = await ticketService.createTicket({ conversationId: 'conv-4' })

    // Round-robin execution
    const res1 = await assignmentService.assignTicketRoundRobin(t1.id, { inboxId })
    const res2 = await assignmentService.assignTicketRoundRobin(t2.id, { inboxId })
    const res3 = await assignmentService.assignTicketRoundRobin(t3.id, { inboxId })
    const res4 = await assignmentService.assignTicketRoundRobin(t4.id, { inboxId })

    // Verify round-robin rotation: A -> B -> C -> A
    expect(res1.assignedAgentId).toBe(agentAId)
    expect(res2.assignedAgentId).toBe(agentBId)
    expect(res3.assignedAgentId).toBe(agentCId)
    expect(res4.assignedAgentId).toBe(agentAId)

    // Verify tickets in store are updated
    const updatedT1 = await ticketService.getTicketById(t1.id)
    const updatedT2 = await ticketService.getTicketById(t2.id)
    const updatedT3 = await ticketService.getTicketById(t3.id)
    const updatedT4 = await ticketService.getTicketById(t4.id)

    expect(updatedT1?.assigneeId).toBe(agentAId)
    expect(updatedT2?.assigneeId).toBe(agentBId)
    expect(updatedT3?.assigneeId).toBe(agentCId)
    expect(updatedT4?.assigneeId).toBe(agentAId)
  })

  it('should skip agents who are offline or busy and only assign to online agents', async () => {
    const inboxId = '22222222-2222-2222-2222-222222222222'
    const agentAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const agentBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const agentCId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

    await assignmentService.registerAgent({
      id: agentAId,
      email: 'agentA@acme.corp',
      displayName: 'Agent Alpha',
      role: 'agent',
      availability: 'online',
      active: true,
    })
    await assignmentService.registerAgent({
      id: agentBId,
      email: 'agentB@acme.corp',
      displayName: 'Agent Bravo',
      role: 'agent',
      availability: 'offline', // OFFLINE
      active: true,
    })
    await assignmentService.registerAgent({
      id: agentCId,
      email: 'agentC@acme.corp',
      displayName: 'Agent Charlie',
      role: 'agent',
      availability: 'busy', // BUSY
      active: true,
    })

    await assignmentService.addInboxMember(inboxId, agentAId)
    await assignmentService.addInboxMember(inboxId, agentBId)
    await assignmentService.addInboxMember(inboxId, agentCId)

    const t1 = await ticketService.createTicket({ conversationId: 'conv-10' })
    const t2 = await ticketService.createTicket({ conversationId: 'conv-11' })

    const res1 = await assignmentService.assignTicketRoundRobin(t1.id, { inboxId })
    const res2 = await assignmentService.assignTicketRoundRobin(t2.id, { inboxId })

    // Only Agent A is online, so both tickets go to Agent A
    expect(res1.assignedAgentId).toBe(agentAId)
    expect(res2.assignedAgentId).toBe(agentAId)
  })

  it('should dynamically adapt when an agent status changes from offline to online', async () => {
    const inboxId = '33333333-3333-3333-3333-333333333333'
    const agentAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const agentBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

    await assignmentService.registerAgent({
      id: agentAId,
      email: 'agentA@acme.corp',
      displayName: 'Agent Alpha',
      role: 'agent',
      availability: 'online',
      active: true,
    })
    await assignmentService.registerAgent({
      id: agentBId,
      email: 'agentB@acme.corp',
      displayName: 'Agent Bravo',
      role: 'agent',
      availability: 'offline',
      active: true,
    })

    await assignmentService.addInboxMember(inboxId, agentAId)
    await assignmentService.addInboxMember(inboxId, agentBId)

    const t1 = await ticketService.createTicket({ conversationId: 'conv-20' })
    const res1 = await assignmentService.assignTicketRoundRobin(t1.id, { inboxId })
    expect(res1.assignedAgentId).toBe(agentAId)

    // Agent B turns online
    await assignmentService.setUserAvailability(agentBId, 'online')

    const t2 = await ticketService.createTicket({ conversationId: 'conv-21' })
    const res2 = await assignmentService.assignTicketRoundRobin(t2.id, { inboxId })
    expect(res2.assignedAgentId).toBe(agentBId)
  })

  it('should skip inactive agents even if their availability is set to online', async () => {
    const inboxId = '44444444-4444-4444-4444-444444444444'
    const agentAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const agentBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

    await assignmentService.registerAgent({
      id: agentAId,
      email: 'agentA@acme.corp',
      displayName: 'Agent Alpha',
      role: 'agent',
      availability: 'online',
      active: false, // DEACTIVATED
    })
    await assignmentService.registerAgent({
      id: agentBId,
      email: 'agentB@acme.corp',
      displayName: 'Agent Bravo',
      role: 'agent',
      availability: 'online',
      active: true,
    })

    await assignmentService.addInboxMember(inboxId, agentAId)
    await assignmentService.addInboxMember(inboxId, agentBId)

    const t1 = await ticketService.createTicket({ conversationId: 'conv-30' })
    const res1 = await assignmentService.assignTicketRoundRobin(t1.id, { inboxId })
    expect(res1.assignedAgentId).toBe(agentBId)
  })

  it('should leave ticket unassigned if all agents in the pool are offline', async () => {
    const inboxId = '55555555-5555-5555-5555-555555555555'
    const agentAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

    await assignmentService.registerAgent({
      id: agentAId,
      email: 'agentA@acme.corp',
      displayName: 'Agent Alpha',
      role: 'agent',
      availability: 'offline',
      active: true,
    })
    await assignmentService.addInboxMember(inboxId, agentAId)

    const t1 = await ticketService.createTicket({ conversationId: 'conv-40' })
    const res1 = await assignmentService.assignTicketRoundRobin(t1.id, { inboxId })

    expect(res1.assignedAgentId).toBeNull()
    expect(res1.reason).toBe('no_online_agents')

    const ticket = await ticketService.getTicketById(t1.id)
    expect(ticket?.assigneeId).toBeNull()
  })

  it('should support Team-based round-robin assignment', async () => {
    const teamId = 'tttttttt-tttt-tttt-tttt-tttttttttttt'
    const agentT1Id = 't1111111-1111-1111-1111-111111111111'
    const agentT2Id = 't2222222-2222-2222-2222-222222222222'

    await teamService.createTeam({
      name: 'Billing Support',
      allowAutoAssign: true,
    })

    await assignmentService.registerAgent({
      id: agentT1Id,
      email: 'billing1@acme.corp',
      displayName: 'Billing Agent 1',
      role: 'agent',
      availability: 'online',
      active: true,
    })
    await assignmentService.registerAgent({
      id: agentT2Id,
      email: 'billing2@acme.corp',
      displayName: 'Billing Agent 2',
      role: 'agent',
      availability: 'online',
      active: true,
    })

    await assignmentService.addTeamMember(teamId, agentT1Id)
    await assignmentService.addTeamMember(teamId, agentT2Id)

    const t1 = await ticketService.createTicket({ conversationId: 'conv-50', teamId })
    const t2 = await ticketService.createTicket({ conversationId: 'conv-51', teamId })

    const res1 = await assignmentService.assignTicketRoundRobin(t1.id, { teamId })
    const res2 = await assignmentService.assignTicketRoundRobin(t2.id, { teamId })

    expect(res1.assignedAgentId).toBe(agentT1Id)
    expect(res2.assignedAgentId).toBe(agentT2Id)
  })

  it('should NOT auto-assign if team has allow_auto_assign set to false', async () => {
    const team = await teamService.createTeam({
      name: 'VIP Escalations',
      allowAutoAssign: false, // DISALLOW AUTO ASSIGN
    })

    const agentId = 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv'
    await assignmentService.registerAgent({
      id: agentId,
      email: 'vip@acme.corp',
      displayName: 'VIP Lead',
      role: 'administrator',
      availability: 'online',
      active: true,
    })
    await assignmentService.addTeamMember(team.id, agentId)

    const t = await ticketService.createTicket({ conversationId: 'conv-60', teamId: team.id })
    const res = await assignmentService.assignTicketRoundRobin(t.id, { teamId: team.id })

    expect(res.assignedAgentId).toBeNull()
    expect(res.reason).toBe('auto_assign_disabled')
  })
})

describe('Assignment Module - Inbound Message Automation Integration', () => {
  beforeEach(() => {
    resetAssignmentStore()
    resetTicketStore()
    resetConversationStore()
    resetInboxStore()
    resetTeamStore()
  })

  it('should automatically round-robin assign newly created tickets during inbound message handling when inbox auto-assign is enabled', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Support Line',
      channelType: 'whatsapp_unofficial',
      enableAutoAssign: true,
    })

    const agentAId = '11111111-aaaa-bbbb-cccc-111111111111'
    const agentBId = '22222222-aaaa-bbbb-cccc-222222222222'

    await assignmentService.registerAgent({
      id: agentAId,
      email: 'a@acme.corp',
      displayName: 'Agent A',
      role: 'agent',
      availability: 'online',
      active: true,
    })
    await assignmentService.registerAgent({
      id: agentBId,
      email: 'b@acme.corp',
      displayName: 'Agent B',
      role: 'agent',
      availability: 'online',
      active: true,
    })

    await assignmentService.addInboxMember(inbox.id, agentAId)
    await assignmentService.addInboxMember(inbox.id, agentBId)

    // First inbound message from Customer 1
    const res1 = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      sourceId: '+6289911110001',
      senderPhone: '+6289911110001',
      senderName: 'Customer One',
      content: 'Halo, saya mau bantuan akun',
    })

    expect(res1.isNewTicket).toBe(true)
    expect(res1.ticket.assigneeId).toBe(agentAId)

    // Second inbound message from Customer 2
    const res2 = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      sourceId: '+6289911110002',
      senderPhone: '+6289911110002',
      senderName: 'Customer Two',
      content: 'Halo, order saya belum sampai',
    })

    expect(res2.isNewTicket).toBe(true)
    expect(res2.ticket.assigneeId).toBe(agentBId)
  })
})

describe('Assignment Module - HTTP API Endpoints', () => {
  beforeEach(() => {
    resetAssignmentStore()
    resetTicketStore()
    resetConversationStore()
    resetInboxStore()
    resetTeamStore()
  })

  it('POST /api/v1/tickets/:id/auto-assign should trigger round-robin assignment for an open ticket', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Sales Inbox',
      channelType: 'whatsapp_unofficial',
      enableAutoAssign: true,
    })

    const agentId = '99999999-9999-9999-9999-999999999999'
    await assignmentService.registerAgent({
      id: agentId,
      email: 'sales@acme.corp',
      displayName: 'Sales Rep',
      role: 'agent',
      availability: 'online',
      active: true,
    })
    await assignmentService.addInboxMember(inbox.id, agentId)

    const ticket = await ticketService.createTicket({ conversationId: 'conv-api-1' })

    const res = await app.request(`/api/v1/tickets/${ticket.id}/auto-assign`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ inboxId: inbox.id }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ticket: { assigneeId: string }; assignedAgentId: string }
    expect(json.assignedAgentId).toBe(agentId)
    expect(json.ticket.assigneeId).toBe(agentId)
  })

  it('PATCH /api/v1/assignment/users/:id/availability should update agent availability', async () => {
    const agentId = '88888888-8888-8888-8888-888888888888'
    await assignmentService.registerAgent({
      id: agentId,
      email: 'agent8@acme.corp',
      displayName: 'Agent 8',
      role: 'agent',
      availability: 'online',
      active: true,
    })

    const res = await app.request(`/api/v1/assignment/users/${agentId}/availability`, {
      method: 'PATCH',
      headers: AUTH_HEADER,
      body: JSON.stringify({ availability: 'busy' }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { user: { availability: string } }
    expect(json.user.availability).toBe('busy')

    const agent = await assignmentService.getAgent(agentId)
    expect(agent?.availability).toBe('busy')
  })

  it('GET /api/v1/assignment/round-robin/next should return the next eligible candidate without assigning', async () => {
    const inboxId = '77777777-7777-7777-7777-777777777777'
    const agentId = '66666666-6666-6666-6666-666666666666'

    await assignmentService.registerAgent({
      id: agentId,
      email: 'next@acme.corp',
      displayName: 'Next In Line',
      role: 'agent',
      availability: 'online',
      active: true,
    })
    await assignmentService.addInboxMember(inboxId, agentId)

    const res = await app.request(`/api/v1/assignment/round-robin/next?inboxId=${inboxId}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { nextAgentId: string; eligibleCount: number }
    expect(json.nextAgentId).toBe(agentId)
    expect(json.eligibleCount).toBe(1)
  })
})

describe('Single Organization & Ubiquitous Language Integrity', () => {
  it('should verify Phase 2 checklist marks Task 2.14 as completed', async () => {
    const checklistFile = Bun.file('docs/PHASE_2_CHECKLIST.md')
    const content = await checklistFile.text()
    expect(content).toContain('- [x] **Task 2.14 (TDD)**')
  })
})
