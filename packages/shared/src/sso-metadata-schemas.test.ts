import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CreateSsoProviderInputSchema,
  OidcCallbackInputSchema,
  OidcMetadataConfigSchema,
  SamlAcsInputSchema,
  SamlMetadataConfigSchema,
  SsoAuthUserSchema,
  SsoProviderSchema,
  SsoProviderTypeSchema,
  UpdateSsoProviderInputSchema,
} from './schemas'

describe('SAML & OIDC Metadata Configuration Schemas (Task 5.8 - packages/shared)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..')
  const validUuid = '123e4567-e89b-12d3-a456-426614174000'

  describe('1. SsoProviderTypeSchema', () => {
    it('should validate valid provider types', () => {
      expect(SsoProviderTypeSchema.safeParse('saml').success).toBe(true)
      expect(SsoProviderTypeSchema.safeParse('oidc').success).toBe(true)
    })

    it('should reject invalid provider types', () => {
      expect(SsoProviderTypeSchema.safeParse('oauth').success).toBe(false)
      expect(SsoProviderTypeSchema.safeParse('google').success).toBe(false)
      expect(SsoProviderTypeSchema.safeParse('').success).toBe(false)
    })
  })

  describe('2. SamlMetadataConfigSchema', () => {
    const validSamlConfig = {
      issuerUrl: 'https://idp.example.com/saml/metadata',
      ssoUrl: 'https://idp.example.com/saml/sso',
      certData: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
      sloUrl: 'https://idp.example.com/saml/slo',
      callbackUrl: 'https://app.xatxoot.com/api/sso/saml/callback',
      signatureAlgorithm: 'rsa-sha256' as const,
      wantAuthnRequestsSigned: true,
    }

    it('should validate complete SAML metadata configuration', () => {
      const result = SamlMetadataConfigSchema.safeParse(validSamlConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.issuerUrl).toBe('https://idp.example.com/saml/metadata')
        expect(result.data.ssoUrl).toBe('https://idp.example.com/saml/sso')
        expect(result.data.certData).toContain('BEGIN CERTIFICATE')
        expect(result.data.signatureAlgorithm).toBe('rsa-sha256')
        expect(result.data.wantAuthnRequestsSigned).toBe(true)
      }
    })

    it('should apply default values for signatureAlgorithm and wantAuthnRequestsSigned', () => {
      const minimalSamlConfig = {
        issuerUrl: 'https://idp.example.com/saml/metadata',
        ssoUrl: 'https://idp.example.com/saml/sso',
        certData: 'MIICIDCCAcigAwIBAgIQD',
      }
      const result = SamlMetadataConfigSchema.safeParse(minimalSamlConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.signatureAlgorithm).toBe('rsa-sha256')
        expect(result.data.wantAuthnRequestsSigned).toBe(false)
      }
    })

    it('should reject invalid or missing issuerUrl and ssoUrl', () => {
      expect(
        SamlMetadataConfigSchema.safeParse({
          ...validSamlConfig,
          issuerUrl: 'not-a-valid-url',
        }).success,
      ).toBe(false)

      expect(
        SamlMetadataConfigSchema.safeParse({
          ...validSamlConfig,
          ssoUrl: 'invalid-sso-url',
        }).success,
      ).toBe(false)
    })

    it('should reject empty certData', () => {
      expect(
        SamlMetadataConfigSchema.safeParse({
          ...validSamlConfig,
          certData: '',
        }).success,
      ).toBe(false)
    })

    it('should reject unsupported signature algorithms', () => {
      expect(
        SamlMetadataConfigSchema.safeParse({
          ...validSamlConfig,
          signatureAlgorithm: 'md5',
        }).success,
      ).toBe(false)
    })
  })

  describe('3. OidcMetadataConfigSchema', () => {
    const validOidcConfig = {
      issuerUrl: 'https://login.example.com/oauth2/v1',
      clientId: 'client-id-enterprise-xyz',
      clientSecret: 'secret-enterprise-12345',
      authorizationUrl: 'https://login.example.com/oauth2/v1/authorize',
      tokenUrl: 'https://login.example.com/oauth2/v1/token',
      userInfoUrl: 'https://login.example.com/oauth2/v1/userinfo',
      jwksUri: 'https://login.example.com/oauth2/v1/keys',
      scopes: ['openid', 'profile', 'email'],
    }

    it('should validate complete OIDC configuration', () => {
      const result = OidcMetadataConfigSchema.safeParse(validOidcConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.issuerUrl).toBe('https://login.example.com/oauth2/v1')
        expect(result.data.clientId).toBe('client-id-enterprise-xyz')
        expect(result.data.scopes).toEqual(['openid', 'profile', 'email'])
      }
    })

    it('should apply default scopes when omitted', () => {
      const minimalOidcConfig = {
        issuerUrl: 'https://login.example.com/oauth2/v1',
        clientId: 'client-id-minimal',
      }
      const result = OidcMetadataConfigSchema.safeParse(minimalOidcConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.scopes).toEqual(['openid', 'profile', 'email'])
      }
    })

    it('should reject invalid issuerUrl or jwksUri', () => {
      expect(
        OidcMetadataConfigSchema.safeParse({
          ...validOidcConfig,
          issuerUrl: 'not-a-url',
        }).success,
      ).toBe(false)

      expect(
        OidcMetadataConfigSchema.safeParse({
          ...validOidcConfig,
          jwksUri: 'not-a-valid-jwks-url',
        }).success,
      ).toBe(false)
    })

    it('should reject empty clientId', () => {
      expect(
        OidcMetadataConfigSchema.safeParse({
          ...validOidcConfig,
          clientId: '',
        }).success,
      ).toBe(false)
    })
  })

  describe('4. CreateSsoProviderInputSchema', () => {
    it('should validate valid SAML provider creation input', () => {
      const input = {
        name: 'Corporate Okta SAML',
        providerType: 'saml' as const,
        issuerUrl: 'https://okta.example.com/saml/entity',
        ssoUrl: 'https://okta.example.com/saml/sso',
        certData: '-----BEGIN CERTIFICATE-----\nSAMPLECERT\n-----END CERTIFICATE-----',
        active: true,
      }
      const result = CreateSsoProviderInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Corporate Okta SAML')
        expect(result.data.providerType).toBe('saml')
        expect(result.data.certData).toContain('SAMPLECERT')
        expect(result.data.active).toBe(true)
      }
    })

    it('should validate valid OIDC provider creation input', () => {
      const input = {
        name: 'Microsoft Entra ID',
        providerType: 'oidc' as const,
        issuerUrl: 'https://login.microsoftonline.com/tenant-id/v2.0',
        clientId: 'entra-app-client-id',
        clientSecret: 'entra-app-client-secret',
        active: true,
      }
      const result = CreateSsoProviderInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Microsoft Entra ID')
        expect(result.data.providerType).toBe('oidc')
        expect(result.data.clientId).toBe('entra-app-client-id')
      }
    })

    it('should require certData when providerType is saml', () => {
      const invalidSaml = {
        name: 'Okta SAML without Cert',
        providerType: 'saml' as const,
        issuerUrl: 'https://okta.example.com/saml/entity',
      }
      const result = CreateSsoProviderInputSchema.safeParse(invalidSaml)
      expect(result.success).toBe(false)
    })

    it('should require clientId when providerType is oidc', () => {
      const invalidOidc = {
        name: 'OIDC without Client ID',
        providerType: 'oidc' as const,
        issuerUrl: 'https://login.example.com',
      }
      const result = CreateSsoProviderInputSchema.safeParse(invalidOidc)
      expect(result.success).toBe(false)
    })

    it('should reject inputs containing account_id or accountId (Single Organization)', () => {
      const invalidWithAccountId = {
        name: 'SAML with tenant leakage',
        providerType: 'saml' as const,
        issuerUrl: 'https://okta.example.com/saml',
        certData: 'CERT',
        accountId: validUuid,
      }
      const result = CreateSsoProviderInputSchema.safeParse(invalidWithAccountId)
      expect(result.success).toBe(false)

      const invalidWithSnakeAccountId = {
        name: 'SAML with snake case account_id',
        providerType: 'saml' as const,
        issuerUrl: 'https://okta.example.com/saml',
        certData: 'CERT',
        account_id: validUuid,
      }
      expect(CreateSsoProviderInputSchema.safeParse(invalidWithSnakeAccountId).success).toBe(false)
    })
  })

  describe('5. UpdateSsoProviderInputSchema', () => {
    it('should allow partial update of SAML/OIDC settings', () => {
      const update = {
        name: 'Updated Enterprise Okta',
        active: false,
        certData: '-----BEGIN CERTIFICATE-----\nNEWCERT\n-----END CERTIFICATE-----',
      }
      const result = UpdateSsoProviderInputSchema.safeParse(update)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Updated Enterprise Okta')
        expect(result.data.active).toBe(false)
        expect(result.data.certData).toContain('NEWCERT')
      }
    })

    it('should reject invalid URL in update payload', () => {
      expect(
        UpdateSsoProviderInputSchema.safeParse({
          issuerUrl: 'not-a-valid-url',
        }).success,
      ).toBe(false)
    })

    it('should reject accountId in update payload', () => {
      expect(
        UpdateSsoProviderInputSchema.safeParse({
          name: 'Updated',
          accountId: validUuid,
        }).success,
      ).toBe(false)
    })
  })

  describe('6. SsoProviderSchema (Database Entity Representation)', () => {
    it('should validate full sso_providers record matching database schema', () => {
      const dbRecord = {
        id: validUuid,
        name: 'Okta Enterprise SSO',
        providerType: 'saml' as const,
        issuerUrl: 'https://okta.example.com/saml',
        clientId: null,
        clientSecretEncrypted: null,
        clientSecretEnc: null,
        certData: 'CERT_DATA',
        ssoUrl: 'https://okta.example.com/saml/sso',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const result = SsoProviderSchema.safeParse(dbRecord)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(validUuid)
        expect(result.data.providerType).toBe('saml')
        expect(result.data.active).toBe(true)
      }
    })
  })

  describe('7. SAML ACS & OIDC Callback Schemas', () => {
    it('should validate SamlAcsInputSchema', () => {
      const validAcs = {
        SAMLResponse:
          'PHNhbWxwOlJlc3BvbnNlIHhtbG5zOnNhbWxwPSJ1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6cHJvdG9jb2wiPjwvc2FtbHA6UmVzcG9uc2U+',
        RelayState: '/dashboard/inbox',
      }
      const result = SamlAcsInputSchema.safeParse(validAcs)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.SAMLResponse).toContain('PHNhbWxw')
        expect(result.data.RelayState).toBe('/dashboard/inbox')
      }

      expect(SamlAcsInputSchema.safeParse({ SAMLResponse: '' }).success).toBe(false)
    })

    it('should validate OidcCallbackInputSchema', () => {
      const validCallback = {
        code: 'auth-code-12345',
        state: 'random-state-xyz',
      }
      const result = OidcCallbackInputSchema.safeParse(validCallback)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.code).toBe('auth-code-12345')
        expect(result.data.state).toBe('random-state-xyz')
      }

      expect(OidcCallbackInputSchema.safeParse({ code: '' }).success).toBe(false)
    })

    it('should validate SsoAuthUserSchema output representation', () => {
      const user = {
        email: 'employee@company.com',
        name: 'Budi Santoso',
        externalId: 'okta-user-98765',
        providerType: 'saml' as const,
      }
      const result = SsoAuthUserSchema.safeParse(user)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('employee@company.com')
        expect(result.data.externalId).toBe('okta-user-98765')
      }
    })
  })

  describe('8. Phase 5 Documentation Checklist', () => {
    it('should have Task 5.8 marked as completed in docs/PHASE_5_CHECKLIST.md', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 5.8**: Skema validasi konfigurasi metadata SAML/OIDC.',
      )
    })
  })
})
