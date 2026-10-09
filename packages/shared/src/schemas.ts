import { z } from 'zod'

export const OrganizationSetupInputSchema = z.object({
  organizationName: z.string().min(1, 'Nama organisasi wajib diisi'),
  adminName: z.string().min(1, 'Nama admin wajib diisi'),
  adminEmail: z.string().email('Format email tidak valid'),
  adminPassword: z.string().min(8, 'Password minimal 8 karakter'),
  timezone: z.string().default('UTC'),
  defaultLocale: z.string().default('en'),
})
export type OrganizationSetupInput = z.infer<typeof OrganizationSetupInputSchema>

export const LoginInputSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})
export type LoginInput = z.infer<typeof LoginInputSchema>

export const RoleSchema = z.enum(['owner', 'administrator', 'agent'])
export type Role = z.infer<typeof RoleSchema>

export const UserAvailabilitySchema = z.enum(['online', 'offline', 'busy'])
export type UserAvailability = z.infer<typeof UserAvailabilitySchema>

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: RoleSchema,
  customRoleId: z.string().uuid().nullable().optional(),
  availability: UserAvailabilitySchema.default('online'),
  avatarUrl: z.string().url().nullable().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().or(z.date()),
})
export type User = z.infer<typeof UserSchema>

export const UserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: RoleSchema,
})
export type UserRole = z.infer<typeof UserRoleSchema>

export const AuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().positive(),
  tokenType: z.literal('Bearer').default('Bearer'),
})
export type AuthTokens = z.infer<typeof AuthTokensSchema>

export const AuthSessionSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
})
export type AuthSession = z.infer<typeof AuthSessionSchema>
