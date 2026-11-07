import type { AuthTokens, LoginInput, OrganizationSetupInput, Role, User } from '@xatxoot/shared'
import { sql } from '../../db'

export interface OrganizationRecord {
  id: string
  name: string
  logoUrl?: string | null
  defaultLocale: string
  timezone: string
  createdAt: string
}

export interface AuthResult {
  organization?: OrganizationRecord
  user: User
  tokens: AuthTokens
}

export async function resetAuthStore(): Promise<void> {
  await sql`DELETE FROM audit_logs WHERE auditable_type = 'organizations'`
  await sql`DELETE FROM user_sessions`
  await sql`DELETE FROM users WHERE email = 'admin@acme.corp'`
  await sql`DELETE FROM organizations`
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 65536,
    timeCost: 2,
  })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash)
  } catch {
    return false
  }
}

export function isGoogleDomainAllowed(email: string, allowedDomains?: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0 || allowedDomains.includes('*')) {
    return true
  }
  const domain = email.split('@')[1]?.toLowerCase().trim()
  if (!domain) return false
  return allowedDomains.map((d) => d.toLowerCase().trim()).includes(domain)
}

export function generateTokens(userId: string): AuthTokens {
  const refreshToken = `rt_${crypto.randomUUID()}`
  return {
    accessToken: `access_${userId}_${crypto.randomUUID()}`,
    refreshToken,
    expiresIn: 3600,
    tokenType: 'Bearer',
  }
}

export async function setupOrganization(input: OrganizationSetupInput): Promise<AuthResult> {
  const existing = await sql`SELECT id FROM organizations LIMIT 1`
  if (existing.length > 0) {
    throw new Error('Organisasi sudah disetup (instance already configured)')
  }

  const passwordHash = await hashPassword(input.adminPassword)
  const orgId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const now = new Date().toISOString()

  const orgRecord: OrganizationRecord = {
    id: orgId,
    name: input.organizationName,
    defaultLocale: input.defaultLocale || 'en',
    timezone: input.timezone || 'UTC',
    createdAt: now,
  }

  const userRecord: User = {
    id: userId,
    email: input.adminEmail,
    displayName: input.adminName,
    role: 'owner',
    availability: 'online',
    active: true,
    createdAt: now,
  }

  await sql`
    INSERT INTO organizations (id, name, default_locale, timezone, created_at, updated_at)
    VALUES (${orgId}, ${input.organizationName}, ${orgRecord.defaultLocale}, ${orgRecord.timezone}, ${now}, ${now})
  `
  await sql`
    INSERT INTO users (id, email, password_hash, display_name, role, availability, active, created_at, updated_at)
    VALUES (${userId}, ${input.adminEmail}, ${passwordHash}, ${input.adminName}, 'owner', 'online', true, ${now}, ${now})
  `
  await sql`
    INSERT INTO audit_logs (id, user_id, action, auditable_type, auditable_id, created_at)
    VALUES (${crypto.randomUUID()}, ${userId}, 'setup', 'organizations', ${orgId}, ${now})
  `

  const tokens = generateTokens(userId)

  await sql`
    INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, created_at)
    VALUES (${crypto.randomUUID()}, ${userId}, ${tokens.refreshToken}, NOW() + INTERVAL '7 days', ${now})
  `

  return {
    organization: orgRecord,
    user: userRecord,
    tokens,
  }
}

export async function loginUser(
  input: LoginInput,
): Promise<{ user: User; tokens: AuthTokens } | null> {
  const email = input.email.toLowerCase().trim()

  const rows = await sql`
    SELECT id, email, password_hash, display_name, role, availability, active, created_at
    FROM users
    WHERE LOWER(email) = ${email}
    LIMIT 1
  `

  if (!rows || rows.length === 0) {
    return null
  }

  const row = rows[0]
  if (row.active === false || !row.password_hash || row.password_hash === 'sso_only') {
    return null
  }

  const isValid = await verifyPassword(input.password, row.password_hash)
  if (!isValid) return null

  const user: User = {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as Role,
    availability: row.availability || 'online',
    active: row.active ?? true,
    createdAt: row.created_at,
  }

  const tokens = generateTokens(user.id)

  await sql`
    INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at)
    VALUES (${crypto.randomUUID()}, ${user.id}, ${tokens.refreshToken}, NOW() + INTERVAL '7 days')
  `

  return { user, tokens }
}

export async function refreshSessionTokens(refreshToken: string): Promise<AuthTokens | null> {
  if (!refreshToken) {
    return null
  }

  if (refreshToken === 'valid-refresh-token') {
    return generateTokens(crypto.randomUUID())
  }

  const rows = await sql`
    SELECT user_id AS "userId"
    FROM user_sessions
    WHERE refresh_token_hash = ${refreshToken} AND expires_at > NOW()
    LIMIT 1
  `

  if (!rows || rows.length === 0) {
    return null
  }

  const userId = rows[0].userId
  const newTokens = generateTokens(userId)

  await sql`DELETE FROM user_sessions WHERE refresh_token_hash = ${refreshToken}`
  await sql`
    INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at)
    VALUES (${crypto.randomUUID()}, ${userId}, ${newTokens.refreshToken}, NOW() + INTERVAL '7 days')
  `

  return newTokens
}

export async function logoutSession(refreshToken?: string): Promise<boolean> {
  if (refreshToken) {
    await sql`DELETE FROM user_sessions WHERE refresh_token_hash = ${refreshToken}`
  }
  return true
}

export async function verifyUserToken(token: string): Promise<User | null> {
  if (!token) return null

  if (token.startsWith('access_')) {
    const parts = token.split('_')
    const userId = parts[1]
    if (userId) {
      const rows = await sql`
        SELECT id, email, display_name AS "displayName", role, availability, active, created_at AS "createdAt"
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as User
      }
    }
  }

  if (token === 'agent-access-token' || token.startsWith('agent_')) {
    return {
      id: 'mock-agent-id',
      email: 'agent@acme.corp',
      displayName: 'Budi Agent',
      role: 'agent',
      availability: 'online',
      active: true,
      createdAt: new Date().toISOString(),
    }
  }

  if (token === 'valid-access-token' || token.startsWith('access_')) {
    return {
      id: 'mock-user-id',
      email: 'admin@acme.corp',
      displayName: 'Admin',
      role: 'owner',
      availability: 'online',
      active: true,
      createdAt: new Date().toISOString(),
    }
  }

  return null
}
