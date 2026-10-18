import type { CreateUserInput, Role, UpdateUserInput, User } from '@xatxoot/shared'
import { sql } from '../../db'

export interface UserWithInboxes extends User {
  inboxes?: Array<{
    id: string
    name: string
    channelType: string
  }>
}

const memoryStore = {
  users: new Map<string, UserWithInboxes>(),
  inboxMembers: new Map<string, Set<string>>(), // userId -> Set<inboxId>
}

export function resetUsersStore(): void {
  memoryStore.users.clear()
  memoryStore.inboxMembers.clear()
}

export class UsersService {
  async listUsers(): Promise<UserWithInboxes[]> {
    try {
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
      if (rows && rows.length > 0) {
        return rows as unknown as UserWithInboxes[]
      }
    } catch {
      // Memory fallback
    }

    return Array.from(memoryStore.users.values())
  }

  async getUserById(id: string): Promise<UserWithInboxes | null> {
    try {
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
    } catch {
      // Memory fallback
    }

    return memoryStore.users.get(id) || null
  }

  async getUserByEmail(email: string): Promise<UserWithInboxes | null> {
    const cleanEmail = email.toLowerCase().trim()
    try {
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
    } catch {
      // Memory fallback
    }

    for (const user of memoryStore.users.values()) {
      if (user.email.toLowerCase() === cleanEmail) {
        return user
      }
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

    const newUser: UserWithInboxes = {
      id,
      email: cleanEmail,
      displayName: input.displayName.trim(),
      role,
      availability: 'online',
      active: true,
      createdAt: now,
      inboxes: [],
    }

    // Insert into DB
    try {
      await sql`
        INSERT INTO users (
          id, email, password_hash, display_name, role, availability, active, created_at
        ) VALUES (
          ${id}, ${cleanEmail}, 'sso_only', ${newUser.displayName}, ${role}, 'online', true, ${now}
        )
      `

      if (input.inboxIds && input.inboxIds.length > 0) {
        for (const inboxId of input.inboxIds) {
          await sql`
            INSERT INTO inbox_members (id, inbox_id, user_id)
            VALUES (${crypto.randomUUID()}, ${inboxId}, ${id})
          `
        }
      }
    } catch {
      // Memory fallback
    }

    memoryStore.users.set(id, newUser)
    if (input.inboxIds) {
      memoryStore.inboxMembers.set(id, new Set(input.inboxIds))
    }

    return newUser
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

    try {
      await sql`
        UPDATE users
        SET
          display_name = ${updatedDisplayName},
          role = ${updatedRole},
          active = ${updatedActive}
        WHERE id = ${id}
      `

      if (input.inboxIds !== undefined) {
        await sql`DELETE FROM inbox_members WHERE user_id = ${id}`
        for (const inboxId of input.inboxIds) {
          await sql`
            INSERT INTO inbox_members (id, inbox_id, user_id)
            VALUES (${crypto.randomUUID()}, ${inboxId}, ${id})
          `
        }
      }
    } catch {
      // Memory fallback
    }

    const updatedUser: UserWithInboxes = {
      ...existing,
      displayName: updatedDisplayName,
      role: updatedRole,
      active: updatedActive,
    }

    memoryStore.users.set(id, updatedUser)
    return updatedUser
  }

  async deleteUser(id: string): Promise<boolean> {
    const existing = await this.getUserById(id)
    if (!existing) return false

    try {
      await sql`
        UPDATE users
        SET active = false
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    const updated = { ...existing, active: false }
    memoryStore.users.set(id, updated)
    return true
  }
}

export const usersService = new UsersService()
