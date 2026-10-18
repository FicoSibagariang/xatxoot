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

export const CreateUserInputSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  displayName: z.string().min(1, 'Nama lengkap wajib diisi'),
  role: z.enum(['administrator', 'agent']).default('agent'),
  inboxIds: z.array(z.string().uuid()).optional(),
  password: z.string().min(8, 'Password minimal 8 karakter').optional(),
})
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>

export const UpdateUserInputSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(['administrator', 'agent']).optional(),
  active: z.boolean().optional(),
  inboxIds: z.array(z.string().uuid()).optional(),
  password: z.string().min(8, 'Password minimal 8 karakter').optional(),
})
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>

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

// ==========================================
// Phase 5: Enterprise SSO & SAML/OIDC (Task 5.8)
// ==========================================

export const SsoProviderTypeSchema = z.enum(['saml', 'oidc'])
export type SsoProviderType = z.infer<typeof SsoProviderTypeSchema>

export const SamlSignatureAlgorithmSchema = z.enum(['rsa-sha256', 'rsa-sha1'])
export type SamlSignatureAlgorithm = z.infer<typeof SamlSignatureAlgorithmSchema>

export const SamlMetadataConfigSchema = z.object({
  issuerUrl: z.string().url('Issuer URL harus berupa URL yang valid'),
  ssoUrl: z.string().url('SSO Login URL harus berupa URL yang valid'),
  certData: z.string().min(1, 'SAML X.509 Certificate wajib diisi'),
  sloUrl: z.string().url('SLO Logout URL harus berupa URL yang valid').optional(),
  callbackUrl: z.string().url('ACS URL harus berupa URL yang valid').optional(),
  signatureAlgorithm: SamlSignatureAlgorithmSchema.default('rsa-sha256'),
  wantAuthnRequestsSigned: z.boolean().default(false),
  identifierFormat: z.string().optional(),
  metadataXml: z.string().optional(),
})
export type SamlMetadataConfig = z.infer<typeof SamlMetadataConfigSchema>

export const OidcMetadataConfigSchema = z.object({
  issuerUrl: z.string().url('Issuer URL harus berupa URL yang valid'),
  clientId: z.string().min(1, 'Client ID wajib diisi'),
  clientSecret: z.string().min(1, 'Client Secret wajib diisi').optional(),
  authorizationUrl: z.string().url('Authorization URL harus berupa URL yang valid').optional(),
  tokenUrl: z.string().url('Token URL harus berupa URL yang valid').optional(),
  userInfoUrl: z.string().url('UserInfo URL harus berupa URL yang valid').optional(),
  jwksUri: z.string().url('JWKS URI harus berupa URL yang valid').optional(),
  scopes: z.array(z.string()).min(1).default(['openid', 'profile', 'email']),
  redirectUri: z.string().url('Redirect URI harus berupa URL yang valid').optional(),
})
export type OidcMetadataConfig = z.infer<typeof OidcMetadataConfigSchema>

export const CreateSsoProviderInputSchema = z
  .object({
    name: z.string().min(1, 'Nama provider wajib diisi').max(255).optional(),
    providerType: SsoProviderTypeSchema,
    issuerUrl: z.string().url('Issuer URL harus berupa URL yang valid'),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    certData: z.string().optional(),
    ssoUrl: z.string().url('SSO URL harus berupa URL yang valid').optional(),
    samlConfig: SamlMetadataConfigSchema.optional(),
    oidcConfig: OidcMetadataConfigSchema.optional(),
    active: z.boolean().default(true),
    accountId: z.never({ message: 'Single Organization: accountId dilarang' }).optional(),
    account_id: z.never({ message: 'Single Organization: account_id dilarang' }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.providerType === 'saml') {
      const hasCert =
        (data.certData && data.certData.trim().length > 0) ||
        (data.samlConfig?.certData && data.samlConfig.certData.trim().length > 0)
      if (!hasCert) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'certData wajib diisi untuk provider SAML',
          path: ['certData'],
        })
      }
    }
    if (data.providerType === 'oidc') {
      const hasClientId =
        (data.clientId && data.clientId.trim().length > 0) ||
        (data.oidcConfig?.clientId && data.oidcConfig.clientId.trim().length > 0)
      if (!hasClientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'clientId wajib diisi untuk provider OIDC',
          path: ['clientId'],
        })
      }
    }
  })
export type CreateSsoProviderInput = z.infer<typeof CreateSsoProviderInputSchema>

export const UpdateSsoProviderInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  issuerUrl: z.string().url('Issuer URL harus berupa URL yang valid').optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  certData: z.string().optional(),
  ssoUrl: z.string().url('SSO URL harus berupa URL yang valid').optional(),
  samlConfig: SamlMetadataConfigSchema.partial().optional(),
  oidcConfig: OidcMetadataConfigSchema.partial().optional(),
  active: z.boolean().optional(),
  accountId: z.never({ message: 'Single Organization: accountId dilarang' }).optional(),
  account_id: z.never({ message: 'Single Organization: account_id dilarang' }).optional(),
})
export type UpdateSsoProviderInput = z.infer<typeof UpdateSsoProviderInputSchema>

export const SsoProviderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  providerType: SsoProviderTypeSchema,
  issuerUrl: z.string(),
  clientId: z.string().nullable().optional(),
  clientSecretEncrypted: z.string().nullable().optional(),
  clientSecretEnc: z.string().nullable().optional(),
  certData: z.string().nullable().optional(),
  ssoUrl: z.string().nullable().optional(),
  samlConfig: SamlMetadataConfigSchema.nullable().optional(),
  oidcConfig: OidcMetadataConfigSchema.nullable().optional(),
  active: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type SsoProvider = z.infer<typeof SsoProviderSchema>

export const SamlAcsInputSchema = z.object({
  SAMLResponse: z.string().min(1, 'SAMLResponse wajib diisi'),
  RelayState: z.string().optional(),
})
export type SamlAcsInput = z.infer<typeof SamlAcsInputSchema>

export const OidcCallbackInputSchema = z.object({
  code: z.string().min(1, 'Authorization code wajib diisi'),
  state: z.string().optional(),
})
export type OidcCallbackInput = z.infer<typeof OidcCallbackInputSchema>

export const SsoAuthUserSchema = z.object({
  email: z.string().email('Email pengguna tidak valid'),
  name: z.string().optional(),
  externalId: z.string().min(1, 'External ID wajib diisi'),
  providerType: SsoProviderTypeSchema,
})
export type SsoAuthUser = z.infer<typeof SsoAuthUserSchema>
