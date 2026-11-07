import type { Role, Ticket, User, UserAvailability } from '@xatxoot/shared'
import { sql, toValidUuid } from '../../db'
import { capacityService } from '../capacity/capacity.service'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { realtimeService } from '../realtime/realtime.service'
import { teamService } from '../teams/teams.service'
import { ticketService } from '../tickets/tickets.service'

export interface AssignmentCandidate {
  id: string
  email: string
  displayName: string
  role: Role
  availability: UserAvailability
  active: boolean
  createdAt?: string
}

export interface RoundRobinOptions {
  inboxId?: string
  teamId?: string
}

export interface RoundRobinResult {
  ticket: Ticket
  assignedAgentId: string | null
  poolKey: string
  success: boolean
  reason?: string
}

export interface NextAgentResult {
  nextAgent: AssignmentCandidate | null
  eligibleCount: number
  poolKey: string
  reason?: string
}

const lastAssignedCursor = new Map<string, string>() // poolKey -> lastAssignedUserId
const rawToUuid = new Map<string, string>()
const uuidToRaw = new Map<string, string>()

function getValidUuid(id: string): string {
  const cached = rawToUuid.get(id)
  if (cached) return cached
  const valid = toValidUuid(id)
  rawToUuid.set(id, valid)
  uuidToRaw.set(valid, id)
  return valid
}

function getOriginalId(validId: string): string {
  return uuidToRaw.get(validId) || validId
}

export async function resetAssignmentStore(): Promise<void> {
  lastAssignedCursor.clear()
  rawToUuid.clear()
  uuidToRaw.clear()
  await sql`DELETE FROM inbox_members`
  await sql`DELETE FROM team_members`
}

export class RoundRobinAssignmentService {
  /**
   * Register or update an agent in the pool
   */
  async registerAgent(
    agent: Partial<AssignmentCandidate> & { id: string },
  ): Promise<AssignmentCandidate> {
    const validId = getValidUuid(agent.id)
    const candidate: AssignmentCandidate = {
      id: agent.id,
      email: agent.email || `agent-${agent.id}@acme.corp`,
      displayName: agent.displayName || `Agent ${agent.id.slice(0, 6)}`,
      role: agent.role || 'agent',
      availability: agent.availability || 'online',
      active: agent.active !== undefined ? agent.active : true,
      createdAt: agent.createdAt || new Date().toISOString(),
    }

    await sql`
      INSERT INTO users (
        id, email, password_hash, display_name, role, availability, active, created_at, updated_at
      ) VALUES (
        ${validId}, ${candidate.email}, 'mock_hash', ${candidate.displayName},
        ${candidate.role}, ${candidate.availability}, ${candidate.active}, ${candidate.createdAt}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        availability = ${candidate.availability},
        active = ${candidate.active},
        display_name = ${candidate.displayName},
        updated_at = NOW()
    `

    return candidate
  }

  /**
   * Get an agent by ID
   */
  async getAgent(id: string): Promise<AssignmentCandidate | null> {
    const validId = getValidUuid(id)
    const rows = await sql`
      SELECT id, email, display_name AS "displayName", role, availability, active, created_at AS "createdAt"
      FROM users
      WHERE id = ${validId}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      const row = rows[0] as Record<string, unknown>
      return {
        ...row,
        id: getOriginalId(row.id as string),
      } as unknown as AssignmentCandidate
    }

    return null
  }

  /**
   * Update an agent's availability (online, offline, busy)
   */
  async setUserAvailability(userId: string, availability: UserAvailability): Promise<User | null> {
    const validId = getValidUuid(userId)
    await sql`
      UPDATE users
      SET availability = ${availability}, updated_at = NOW()
      WHERE id = ${validId}
    `

    realtimeService.broadcast({
      event: 'user.presence',
      data: { userId, availability },
    })

    const found = await this.getAgent(userId)
    if (!found) {
      return {
        id: userId,
        email: `${userId}@acme.corp`,
        displayName: 'Agent',
        role: 'agent',
        availability,
        active: true,
        createdAt: new Date().toISOString(),
      }
    }

    return {
      id: found.id,
      email: found.email,
      displayName: found.displayName,
      role: found.role,
      availability: found.availability,
      active: found.active,
      createdAt: found.createdAt || new Date().toISOString(),
    }
  }

  /**
   * Add an agent as an inbox member
   */
  async addInboxMember(inboxId: string, userId: string): Promise<void> {
    const validInboxId = getValidUuid(inboxId)
    const validUserId = getValidUuid(userId)
    await inboxService.addInboxMember(validInboxId, validUserId)
  }

  /**
   * Add an agent as a team member
   */
  async addTeamMember(teamId: string, userId: string): Promise<void> {
    const validTeamId = getValidUuid(teamId)
    const validUserId = getValidUuid(userId)
    await sql`
      INSERT INTO teams (id, name, allow_auto_assign, created_at, updated_at)
      VALUES (${validTeamId}, 'Team ' || ${validTeamId}, true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `
    await teamService.addMember(validTeamId, validUserId)
  }

  /**
   * Retrieve eligible candidates for a given pool
   */
  async getEligibleCandidates(options: RoundRobinOptions): Promise<{
    candidates: AssignmentCandidate[]
    poolKey: string
    reason?: string
  }> {
    // 1. Team-based assignment pool
    if (options.teamId) {
      const validTeamId = getValidUuid(options.teamId)
      const poolKey = `team:${options.teamId}`
      const team = await teamService.getTeam(validTeamId)
      if (team && team.allowAutoAssign === false) {
        return { candidates: [], poolKey, reason: 'auto_assign_disabled' }
      }

      const candidateIds = new Set<string>()
      const teamMembers = await teamService.listMembers(validTeamId)
      for (const tm of teamMembers) candidateIds.add(getOriginalId(tm.userId))

      const onlineAgents: AssignmentCandidate[] = []
      for (const uid of candidateIds) {
        const agent = await this.getAgent(uid)
        if (agent?.active && agent.availability === 'online') {
          onlineAgents.push(agent)
        }
      }

      if (onlineAgents.length === 0) {
        return { candidates: [], poolKey, reason: 'no_online_agents' }
      }

      const candidates: AssignmentCandidate[] = []
      for (const agent of onlineAgents) {
        const check = await capacityService.canAssignTicket(getValidUuid(agent.id))
        if (check.allowed) {
          candidates.push(agent)
        }
      }

      candidates.sort((a, b) => a.id.localeCompare(b.id))

      if (candidates.length === 0) {
        return { candidates: [], poolKey, reason: 'all_agents_at_capacity' }
      }
      return { candidates, poolKey }
    }

    // 2. Inbox-based assignment pool
    if (options.inboxId) {
      const validInboxId = getValidUuid(options.inboxId)
      const poolKey = `inbox:${options.inboxId}`
      const inboxData = await inboxService.getInboxById(validInboxId)
      if (inboxData && inboxData.inbox.enableAutoAssign === false) {
        return { candidates: [], poolKey, reason: 'auto_assign_disabled' }
      }

      const candidateIds = new Set<string>()
      const inboxMembers = await inboxService.listInboxMembers(validInboxId)
      for (const im of inboxMembers) candidateIds.add(getOriginalId(im.userId))

      const onlineAgents: AssignmentCandidate[] = []
      for (const uid of candidateIds) {
        const agent = await this.getAgent(uid)
        if (agent?.active && agent.availability === 'online') {
          onlineAgents.push(agent)
        }
      }

      if (onlineAgents.length === 0) {
        return { candidates: [], poolKey, reason: 'no_online_agents' }
      }

      const candidates: AssignmentCandidate[] = []
      for (const agent of onlineAgents) {
        const check = await capacityService.canAssignTicket(getValidUuid(agent.id), validInboxId)
        if (check.allowed) {
          candidates.push(agent)
        }
      }

      candidates.sort((a, b) => a.id.localeCompare(b.id))

      if (candidates.length === 0) {
        return { candidates: [], poolKey, reason: 'all_agents_at_capacity' }
      }
      return { candidates, poolKey }
    }

    return { candidates: [], poolKey: 'global', reason: 'pool_not_specified' }
  }

  /**
   * Preview next round-robin agent without advancing the cursor
   */
  async getNextRoundRobinAgent(options: RoundRobinOptions): Promise<NextAgentResult> {
    const { candidates, poolKey, reason } = await this.getEligibleCandidates(options)
    if (candidates.length === 0) {
      return {
        nextAgent: null,
        eligibleCount: 0,
        poolKey,
        reason: reason || 'no_online_agents',
      }
    }

    const lastAssignedId = lastAssignedCursor.get(poolKey)
    let nextIndex = 0

    if (lastAssignedId) {
      const lastIndex = candidates.findIndex((c) => c.id === lastAssignedId)
      if (lastIndex !== -1) {
        nextIndex = (lastIndex + 1) % candidates.length
      } else {
        nextIndex = 0
      }
    }

    return {
      nextAgent: candidates[nextIndex],
      eligibleCount: candidates.length,
      poolKey,
    }
  }

  /**
   * Assign a ticket to the next online agent via Round-Robin
   */
  async assignTicketRoundRobin(
    ticketId: string,
    options?: RoundRobinOptions,
  ): Promise<RoundRobinResult> {
    const ticket = await ticketService.getTicketById(ticketId)
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`)
    }

    const poolOptions: RoundRobinOptions = { ...options }
    if (!poolOptions.teamId && ticket.teamId) {
      poolOptions.teamId = ticket.teamId
    }

    if (!poolOptions.inboxId && !poolOptions.teamId && ticket.conversationId) {
      const conv = await conversationService.getConversationDetail(ticket.conversationId)
      if (conv?.conversation?.inboxId) {
        poolOptions.inboxId = conv.conversation.inboxId
      }
    }

    const { nextAgent, poolKey, reason } = await this.getNextRoundRobinAgent(poolOptions)

    if (!nextAgent) {
      return {
        ticket,
        assignedAgentId: null,
        poolKey,
        success: false,
        reason: reason || 'no_online_agents',
      }
    }

    lastAssignedCursor.set(poolKey, nextAgent.id)

    const validAgentId = getValidUuid(nextAgent.id)
    const updatedTicket = await ticketService.assignTicket(ticket.id, validAgentId)
    const finalTicket = {
      ...updatedTicket,
      assigneeId: nextAgent.id,
    }

    realtimeService.broadcast({
      event: 'ticket.assigned',
      data: {
        ticket: finalTicket,
        assignedAgentId: nextAgent.id,
        poolKey,
      },
    })

    return {
      ticket: finalTicket,
      assignedAgentId: nextAgent.id,
      poolKey,
      success: true,
    }
  }
}

export const assignmentService = new RoundRobinAssignmentService()
