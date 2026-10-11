import type { CreateTeamInput, Team, TeamMember, UpdateTeamInput } from '@xatxoot/shared'
import { sql } from '../../db'

export type { Team, TeamMember, CreateTeamInput, UpdateTeamInput }

const memoryStore = {
  teams: new Map<string, Team>(),
  teamMembers: new Map<string, TeamMember>(), // key: `${teamId}:${userId}`
}

export function resetTeamStore(): void {
  memoryStore.teams.clear()
  memoryStore.teamMembers.clear()
}

export class TeamService {
  async createTeam(dto: CreateTeamInput): Promise<Team> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const allowAutoAssign = dto.allowAutoAssign ?? true

    const record: Team = {
      id,
      name: dto.name,
      description: dto.description ?? null,
      allowAutoAssign,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await sql`
        INSERT INTO teams (
          id, name, description, allow_auto_assign, created_at, updated_at
        ) VALUES (
          ${id}, ${record.name}, ${record.description}, ${allowAutoAssign}, ${now}, ${now}
        )
      `
    } catch {
      // DB offline fallback
    }

    memoryStore.teams.set(id, record)
    return record
  }

  async listTeams(): Promise<Team[]> {
    try {
      const rows = await sql`
        SELECT id, name, description, allow_auto_assign AS "allowAutoAssign",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM teams
        ORDER BY created_at ASC
      `
      if (rows && rows.length > 0) {
        return rows as unknown as Team[]
      }
    } catch {
      // DB offline fallback
    }

    return Array.from(memoryStore.teams.values())
  }

  async getTeam(id: string): Promise<Team | null> {
    try {
      const rows = await sql`
        SELECT id, name, description, allow_auto_assign AS "allowAutoAssign",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM teams
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as Team
      }
    } catch {
      // DB offline fallback
    }

    return memoryStore.teams.get(id) || null
  }

  async updateTeam(id: string, dto: UpdateTeamInput): Promise<Team | null> {
    const existing = await this.getTeam(id)
    if (!existing) {
      return null
    }

    const now = new Date().toISOString()
    const updated: Team = {
      ...existing,
      name: dto.name ?? existing.name,
      description: dto.description !== undefined ? dto.description : existing.description,
      allowAutoAssign:
        dto.allowAutoAssign !== undefined ? dto.allowAutoAssign : existing.allowAutoAssign,
      updatedAt: now,
    }

    try {
      await sql`
        UPDATE teams
        SET name = ${updated.name},
            description = ${updated.description},
            allow_auto_assign = ${updated.allowAutoAssign},
            updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // DB offline fallback
    }

    memoryStore.teams.set(id, updated)
    return updated
  }

  async deleteTeam(id: string): Promise<boolean> {
    const existing = await this.getTeam(id)
    if (!existing) {
      return false
    }

    try {
      await sql`DELETE FROM teams WHERE id = ${id}`
    } catch {
      // DB offline fallback
    }

    memoryStore.teams.delete(id)
    for (const [key, member] of memoryStore.teamMembers.entries()) {
      if (member.teamId === id) {
        memoryStore.teamMembers.delete(key)
      }
    }

    return true
  }

  async addMember(teamId: string, userId: string): Promise<TeamMember> {
    const team = await this.getTeam(teamId)
    if (!team) {
      throw new Error('Team not found')
    }

    const key = `${teamId}:${userId}`
    if (memoryStore.teamMembers.has(key)) {
      throw new Error('User is already a member of this team')
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const member: TeamMember = {
      id,
      teamId,
      userId,
      createdAt: now,
    }

    try {
      await sql`
        INSERT INTO team_members (
          id, team_id, user_id, created_at
        ) VALUES (
          ${id}, ${teamId}, ${userId}, ${now}
        )
      `
    } catch {
      // DB offline fallback
    }

    memoryStore.teamMembers.set(key, member)
    return member
  }

  async listMembers(teamId: string): Promise<TeamMember[]> {
    try {
      const rows = await sql`
        SELECT id, team_id AS "teamId", user_id AS "userId", created_at AS "createdAt"
        FROM team_members
        WHERE team_id = ${teamId}
        ORDER BY created_at ASC
      `
      if (rows && rows.length > 0) {
        return rows as unknown as TeamMember[]
      }
    } catch {
      // DB offline fallback
    }

    const members: TeamMember[] = []
    for (const member of memoryStore.teamMembers.values()) {
      if (member.teamId === teamId) {
        members.push(member)
      }
    }
    return members
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const key = `${teamId}:${userId}`
    const exists = memoryStore.teamMembers.has(key)

    try {
      await sql`
        DELETE FROM team_members
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `
    } catch {
      // DB offline fallback
    }

    if (exists) {
      memoryStore.teamMembers.delete(key)
      return true
    }

    return false
  }
}

export const teamService = new TeamService()
