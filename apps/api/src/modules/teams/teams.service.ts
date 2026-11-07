import type { CreateTeamInput, Team, TeamMember, UpdateTeamInput } from '@xatxoot/shared'
import { sql, toValidUuid } from '../../db'

export type { Team, TeamMember, CreateTeamInput, UpdateTeamInput }

export async function resetTeamStore(): Promise<void> {
  await sql`DELETE FROM team_members`
  await sql`DELETE FROM teams`
}

export class TeamService {
  async createTeam(dto: CreateTeamInput): Promise<Team> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const allowAutoAssign = dto.allowAutoAssign ?? true

    const rows = await sql`
      INSERT INTO teams (
        id, name, description, allow_auto_assign, created_at, updated_at
      ) VALUES (
        ${id}, ${dto.name}, ${dto.description ?? null}, ${allowAutoAssign}, ${now}, ${now}
      )
      RETURNING id, name, description, allow_auto_assign AS "allowAutoAssign",
                created_at AS "createdAt", updated_at AS "updatedAt"
    `
    return rows[0] as unknown as Team
  }

  async listTeams(): Promise<Team[]> {
    const rows = await sql`
      SELECT id, name, description, allow_auto_assign AS "allowAutoAssign",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM teams
      ORDER BY created_at ASC
    `
    return rows as unknown as Team[]
  }

  async getTeam(id: string): Promise<Team | null> {
    const vId = toValidUuid(id)
    const rows = await sql`
      SELECT id, name, description, allow_auto_assign AS "allowAutoAssign",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM teams
      WHERE id = ${vId}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return rows[0] as unknown as Team
    }

    return null
  }

  async updateTeam(id: string, dto: UpdateTeamInput): Promise<Team | null> {
    const vId = toValidUuid(id)
    const existing = await this.getTeam(vId)
    if (!existing) {
      return null
    }

    const now = new Date().toISOString()
    const name = dto.name ?? existing.name
    const description = dto.description !== undefined ? dto.description : existing.description
    const allowAutoAssign =
      dto.allowAutoAssign !== undefined ? dto.allowAutoAssign : existing.allowAutoAssign

    const rows = await sql`
      UPDATE teams
      SET name = ${name},
          description = ${description},
          allow_auto_assign = ${allowAutoAssign},
          updated_at = ${now}
      WHERE id = ${vId}
      RETURNING id, name, description, allow_auto_assign AS "allowAutoAssign",
                created_at AS "createdAt", updated_at AS "updatedAt"
    `
    if (rows && rows.length > 0) {
      return rows[0] as unknown as Team
    }

    return null
  }

  async deleteTeam(id: string): Promise<boolean> {
    const vId = toValidUuid(id)
    const rows = await sql`DELETE FROM teams WHERE id = ${vId} RETURNING id`
    return rows.length > 0
  }

  async addMember(teamId: string, userId: string): Promise<TeamMember> {
    const vTeamId = toValidUuid(teamId)
    const vUserId = toValidUuid(userId)
    const team = await this.getTeam(vTeamId)
    if (!team) {
      throw new Error('Team not found')
    }

    await sql`
      INSERT INTO users (id, email, password_hash, display_name, role, availability, active, created_at, updated_at)
      VALUES (${vUserId}, ${vUserId} || '@acme.corp', 'mock_hash', 'User ' || ${vUserId}, 'agent', 'online', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `

    const existingMember = await sql`
      SELECT id FROM team_members WHERE team_id = ${vTeamId} AND user_id = ${vUserId} LIMIT 1
    `
    if (existingMember && existingMember.length > 0) {
      throw new Error('User is already a member of this team')
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await sql`
      INSERT INTO team_members (
        id, team_id, user_id, created_at
      ) VALUES (
        ${id}, ${vTeamId}, ${vUserId}, ${now}
      )
      RETURNING id, team_id AS "teamId", user_id AS "userId", created_at AS "createdAt"
    `
    return rows[0] as unknown as TeamMember
  }

  async listMembers(teamId: string): Promise<TeamMember[]> {
    const vTeamId = toValidUuid(teamId)
    const rows = await sql`
      SELECT id, team_id AS "teamId", user_id AS "userId", created_at AS "createdAt"
      FROM team_members
      WHERE team_id = ${vTeamId}
      ORDER BY created_at ASC
    `
    return rows as unknown as TeamMember[]
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const vTeamId = toValidUuid(teamId)
    const vUserId = toValidUuid(userId)
    const rows = await sql`
      DELETE FROM team_members
      WHERE team_id = ${vTeamId} AND user_id = ${vUserId}
      RETURNING id
    `
    return rows.length > 0
  }
}

export const teamService = new TeamService()
