import type { Role, Ticket, User, UserAvailability } from '@xatxoot/shared'
import { sql } from '../../db'
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

interface AssignmentMemoryStore {
  agents: Map<string, AssignmentCandidate>
  inboxMembers: Map<string, Set<string>> // inboxId -> Set<userId>
  teamMembers: Map<string, Set<string>> // teamId -> Set<userId>
  lastAssigned: Map<string, string> // poolKey -> lastAssignedUserId
}

const memoryStore: AssignmentMemoryStore = {
  agents: new Map(),
  inboxMembers: new Map(),
  teamMembers: new Map(),
  lastAssigned: new Map(),
}

export function resetAssignmentStore(): void {
  memoryStore.agents.clear()
  memoryStore.inboxMembers.clear()
  memoryStore.teamMembers.clear()
  memoryStore.lastAssigned.clear()
}

export class RoundRobinAssignmentService {
  /**
   * Register or update an agent in the pool
   */
  async registerAgent(
    agent: Partial<AssignmentCandidate> & { id: string },
  ): Promise<AssignmentCandidate> {
    const candidate: AssignmentCandidate = {
      id: agent.id,
      email: agent.email || `agent-${agent.id}@acme.corp`,
      displayName: agent.displayName || `Agent ${agent.id.slice(0, 6)}`,
      role: agent.role || 'agent',
      availability: agent.availability || 'online',
      active: agent.active !== undefined ? agent.active : true,
      createdAt: agent.createdAt || new Date().toISOString(),
    }

    memoryStore.agents.set(agent.id, candidate)

    try {
      await sql`
        INSERT INTO users (
          id, email, password_hash, display_name, role, availability, active, created_at
        ) VALUES (
          ${candidate.id}, ${candidate.email}, 'mock_hash', ${candidate.displayName},
          ${candidate.role}, ${candidate.availability}, ${candidate.active}, ${candidate.createdAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          availability = ${candidate.availability},
          active = ${candidate.active},
          display_name = ${candidate.displayName}
      `
    } catch {
      // Memory fallback for tests/offline
    }

    return candidate
  }

  /**
   * Get an agent by ID
   */
  async getAgent(id: string): Promise<AssignmentCandidate | null> {
    const inMem = memoryStore.agents.get(id)
    if (inMem) return inMem

    try {
      const rows = await sql`
        SELECT id, email, display_name AS "displayName", role, availability, active, created_at AS "createdAt"
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as AssignmentCandidate
      }
    } catch {
      // Memory fallback
    }

    return null
  }

  /**
   * Update an agent's availability (online, offline, busy)
   */
  async setUserAvailability(userId: string, availability: UserAvailability): Promise<User | null> {
    const agent = memoryStore.agents.get(userId)
    if (agent) {
      agent.availability = availability
      memoryStore.agents.set(userId, agent)
    }

    try {
      await sql`
        UPDATE users
        SET availability = ${availability}
        WHERE id = ${userId}
      `
    } catch {
      // Memory fallback
    }

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
    if (!memoryStore.inboxMembers.has(inboxId)) {
      memoryStore.inboxMembers.set(inboxId, new Set())
    }
    memoryStore.inboxMembers.get(inboxId)?.add(userId)

    try {
      await inboxService.addInboxMember(inboxId, userId)
    } catch {
      // Fallback
    }
  }

  /**
   * Add an agent as a team member
   */
  async addTeamMember(teamId: string, userId: string): Promise<void> {
    if (!memoryStore.teamMembers.has(teamId)) {
      memoryStore.teamMembers.set(teamId, new Set())
    }
    memoryStore.teamMembers.get(teamId)?.add(userId)

    try {
      await teamService.addMember(teamId, userId)
    } catch {
      // Fallback
    }
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
      const poolKey = `team:${options.teamId}`
      const team = await teamService.getTeam(options.teamId)
      if (team && team.allowAutoAssign === false) {
        return { candidates: [], poolKey, reason: 'auto_assign_disabled' }
      }

      const candidateIds = new Set<string>()
      const memTeam = memoryStore.teamMembers.get(options.teamId)
      if (memTeam) {
        for (const uid of memTeam) candidateIds.add(uid)
      }

      try {
        const teamMembers = await teamService.listMembers(options.teamId)
        for (const tm of teamMembers) candidateIds.add(tm.userId)
      } catch {
        // Fallback
      }

      const candidates: AssignmentCandidate[] = []
      for (const uid of candidateIds) {
        const agent = await this.getAgent(uid)
        if (agent?.active && agent.availability === 'online') {
          candidates.push(agent)
        }
      }

      // Sort deterministically
      candidates.sort((a, b) => a.id.localeCompare(b.id))

      if (candidates.length === 0) {
        return { candidates: [], poolKey, reason: 'no_online_agents' }
      }
      return { candidates, poolKey }
    }

    // 2. Inbox-based assignment pool
    if (options.inboxId) {
      const poolKey = `inbox:${options.inboxId}`
      const inboxData = await inboxService.getInboxById(options.inboxId)
      if (inboxData && inboxData.inbox.enableAutoAssign === false) {
        return { candidates: [], poolKey, reason: 'auto_assign_disabled' }
      }

      const candidateIds = new Set<string>()
      const memInbox = memoryStore.inboxMembers.get(options.inboxId)
      if (memInbox) {
        for (const uid of memInbox) candidateIds.add(uid)
      }

      try {
        const inboxMembers = await inboxService.listInboxMembers(options.inboxId)
        for (const im of inboxMembers) candidateIds.add(im.userId)
      } catch {
        // Fallback
      }

      const candidates: AssignmentCandidate[] = []
      for (const uid of candidateIds) {
        const agent = await this.getAgent(uid)
        if (agent?.active && agent.availability === 'online') {
          candidates.push(agent)
        }
      }

      // Sort deterministically
      candidates.sort((a, b) => a.id.localeCompare(b.id))

      if (candidates.length === 0) {
        return { candidates: [], poolKey, reason: 'no_online_agents' }
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

    const lastAssignedId = memoryStore.lastAssigned.get(poolKey)
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

    // Determine target pool options if not explicitly supplied
    const poolOptions: RoundRobinOptions = { ...options }
    if (!poolOptions.teamId && ticket.teamId) {
      poolOptions.teamId = ticket.teamId
    }

    if (!poolOptions.inboxId && !poolOptions.teamId && ticket.conversationId) {
      try {
        const conv = await conversationService.getConversationDetail(ticket.conversationId)
        if (conv?.conversation.inboxId) {
          poolOptions.inboxId = conv.conversation.inboxId
        }
      } catch {
        // Fallback
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

    // Advance round-robin cursor for this pool
    memoryStore.lastAssigned.set(poolKey, nextAgent.id)

    // Assign ticket
    const updatedTicket = await ticketService.assignTicket(ticket.id, nextAgent.id)

    // Broadcast assignment event
    realtimeService.broadcast({
      event: 'ticket.assigned',
      data: {
        ticket: updatedTicket,
        assignedAgentId: nextAgent.id,
        poolKey,
      },
    })

    return {
      ticket: updatedTicket,
      assignedAgentId: nextAgent.id,
      poolKey,
      success: true,
    }
  }
}

export const assignmentService = new RoundRobinAssignmentService()
