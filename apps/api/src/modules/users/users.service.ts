import type { CreateUserInput, Role, UpdateUserInput, User } from '@xatxoot/shared'
import { sql } from '../../db'
import { hashPassword } from '../auth/auth.service'

export interface UserWithInboxes extends User {
  inboxes?: Array<{
    id: string
    name: string
    channelType: string
  }>
}

export async function resetUsersStore(): Promise<void> {
  await sql`DELETE FROM inbox_members`
  await sql`DELETE FROM users WHERE email LIKE '%@xatxoot.test' OR email LIKE '%@nusa.net.id' OR email LIKE '%@example.com'`
}

export class UsersService {
  async listUsers(): Promise<UserWithInboxes[]> {
    const rows = await sql`
      SELECT
        u.id,
        u.email,
        u.display_name as "displayName",
        u.role,
        u.availability,
        u.active,
        u.avatar_url as "avatarUrl",
        u.created_at as "createdAt",
        COALESCE(
          json_agg(
            json_build_object('id', i.id, 'name', i.name, 'channelType', i.channel_type)
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) as inboxes
      FROM users u
      LEFT JOIN inbox_members im ON u.id = im.user_id
      LEFT JOIN inboxes i ON im.inbox_id = i.id
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `
    return rows as unknown as UserWithInboxes[]
  }

  async getUserById(id: string): Promise<UserWithInboxes | null> {
    const rows = await sql`
      SELECT
        u.id,
        u.email,
        u.display_name as "displayName",
        u.role,
        u.availability,
        u.active,
        u.avatar_url as "avatarUrl",
        u.created_at as "createdAt",
        COALESCE(
          json_agg(
            json_build_object('id', i.id, 'name', i.name, 'channelType', i.channel_type)
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) as inboxes
      FROM users u
      LEFT JOIN inbox_members im ON u.id = im.user_id
      LEFT JOIN inboxes i ON im.inbox_id = i.id
      WHERE u.id = ${id}
      GROUP BY u.id
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return rows[0] as unknown as UserWithInboxes
    }

    return null
  }

  async getUserByEmail(email: string): Promise<UserWithInboxes | null> {
    const cleanEmail = email.toLowerCase().trim()
    const rows = await sql`
      SELECT
        u.id,
        u.email,
        u.display_name as "displayName",
        u.role,
        u.availability,
        u.active,
        u.avatar_url as "avatarUrl",
        u.created_at as "createdAt"
      FROM users u
      WHERE LOWER(u.email) = ${cleanEmail}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return rows[0] as unknown as UserWithInboxes
    }

    return null
  }

  async createUser(input: CreateUserInput): Promise<UserWithInboxes> {
    const cleanEmail = input.email.toLowerCase().trim()
    const existing = await this.getUserByEmail(cleanEmail)
    if (existing) {
      throw new Error(`Email (${cleanEmail}) sudah terdaftar sebagai staf`)
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const role: Role = input.role || 'agent'
    const displayName = input.displayName.trim()

    let passwordHash = 'sso_only'
    if (input.password && input.password.trim().length >= 8) {
      passwordHash = await hashPassword(input.password)
    }

    const rows = await sql`
      INSERT INTO users (
        id, email, password_hash, display_name, role, availability, active, created_at, updated_at
      ) VALUES (
        ${id}, ${cleanEmail}, ${passwordHash}, ${displayName}, ${role}, 'online', true, ${now}, ${now}
      )
      RETURNING id, email, display_name AS "displayName", role, availability, active, created_at AS "createdAt"
    `

    if (input.inboxIds && input.inboxIds.length > 0) {
      for (const inboxId of input.inboxIds) {
        await sql`
          INSERT INTO inbox_members (id, inbox_id, user_id)
          VALUES (${crypto.randomUUID()}, ${inboxId}, ${id})
        `
      }
    }

    return {
      ...(rows[0] as unknown as UserWithInboxes),
      inboxes: [],
    }
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<UserWithInboxes> {
    const existing = await this.getUserById(id)
    if (!existing) {
      throw new Error(`User dengan ID ${id} tidak ditemukan`)
    }

    const updatedDisplayName =
      input.displayName !== undefined ? input.displayName.trim() : existing.displayName
    const updatedRole = input.role !== undefined ? input.role : existing.role
    const updatedActive = input.active !== undefined ? input.active : existing.active
    const now = new Date().toISOString()

    let newPasswordHash: string | null = null
    if (input.password && input.password.trim().length >= 8) {
      newPasswordHash = await hashPassword(input.password)
    }

    if (newPasswordHash) {
      await sql`
        UPDATE users
        SET
          display_name = ${updatedDisplayName},
          role = ${updatedRole},
          active = ${updatedActive},
          password_hash = ${newPasswordHash},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } else {
      await sql`
        UPDATE users
        SET
          display_name = ${updatedDisplayName},
          role = ${updatedRole},
          active = ${updatedActive},
          updated_at = ${now}
        WHERE id = ${id}
      `
    }

    if (input.inboxIds !== undefined) {
      await sql`DELETE FROM inbox_members WHERE user_id = ${id}`
      for (const inboxId of input.inboxIds) {
        await sql`
          INSERT INTO inbox_members (id, inbox_id, user_id)
          VALUES (${crypto.randomUUID()}, ${inboxId}, ${id})
        `
      }
    }

    const updated = await this.getUserById(id)
    if (!updated) {
      throw new Error(`User not found: ${id}`)
    }
    return updated
  }

  async deleteUser(id: string): Promise<boolean> {
    const existing = await this.getUserById(id)
    if (!existing) return false

    await sql`
      UPDATE users
      SET active = false, updated_at = NOW()
      WHERE id = ${id}
    `
    return true
  }
}

export const usersService = new UsersService()
