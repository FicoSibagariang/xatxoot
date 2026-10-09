import { describe, expect, it } from 'bun:test'
import {
  AuthSessionSchema,
  AuthTokensSchema,
  LoginInputSchema,
  OrganizationSetupInputSchema,
  RoleSchema,
  UserRoleSchema,
  UserSchema,
} from './index'

describe('Zod Validation Schemas and TypeScript Types', () => {
  describe('OrganizationSetupInputSchema', () => {
    it('should validate valid organization setup input', () => {
      const valid = {
        organizationName: 'Acme Corp',
        adminName: 'Admin User',
        adminEmail: 'admin@acme.com',
        adminPassword: 'Password123!',
        defaultLocale: 'id',
        timezone: 'Asia/Jakarta',
      }

      const result = OrganizationSetupInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.organizationName).toBe('Acme Corp')
        expect(result.data.adminEmail).toBe('admin@acme.com')
      }
    })

    it('should reject invalid email and short password (< 8 chars)', () => {
      const invalid = {
        organizationName: 'Acme Corp',
        adminName: 'Admin User',
        adminEmail: 'invalid-email',
        adminPassword: 'short',
      }

      const result = OrganizationSetupInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('LoginInputSchema', () => {
    it('should validate valid login credentials', () => {
      const valid = {
        email: 'staff@xatxoot.com',
        password: 'secretPassword',
      }

      const result = LoginInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('staff@xatxoot.com')
      }
    })

    it('should reject invalid email or empty password', () => {
      const invalid = {
        email: 'not-an-email',
        password: '',
      }

      const result = LoginInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('User and Role Schemas', () => {
    it('should validate allowed system roles: owner, administrator, agent', () => {
      expect(RoleSchema.safeParse('owner').success).toBe(true)
      expect(RoleSchema.safeParse('administrator').success).toBe(true)
      expect(RoleSchema.safeParse('agent').success).toBe(true)
      expect(RoleSchema.safeParse('superadmin').success).toBe(false)
    })

    it('should validate complete user record', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'agent@xatxoot.com',
        displayName: 'Budi Santoso',
        role: 'agent',
        availability: 'online',
        active: true,
        createdAt: new Date().toISOString(),
      }

      const result = UserSchema.safeParse(user)
      expect(result.success).toBe(true)
    })

    it('should validate UserRole mapping', () => {
      const userRole = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'administrator',
      }

      const result = UserRoleSchema.safeParse(userRole)
      expect(result.success).toBe(true)
    })
  })

  describe('AuthTokens and AuthSession Schemas', () => {
    it('should validate AuthTokens', () => {
      const tokens = {
        accessToken: 'access-token-jwt',
        refreshToken: 'refresh-token-jwt',
        expiresIn: 3600,
        tokenType: 'Bearer',
      }

      const result = AuthTokensSchema.safeParse(tokens)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tokenType).toBe('Bearer')
      }
    })

    it('should validate AuthSession with nested user and tokens', () => {
      const session = {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'admin@xatxoot.com',
          displayName: 'Administrator',
          role: 'owner',
          availability: 'online',
          active: true,
          createdAt: new Date().toISOString(),
        },
        tokens: {
          accessToken: 'access-token-jwt',
          refreshToken: 'refresh-token-jwt',
          expiresIn: 3600,
        },
      }

      const result = AuthSessionSchema.safeParse(session)
      expect(result.success).toBe(true)
    })
  })
})
