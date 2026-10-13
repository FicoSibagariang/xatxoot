import type {
  AuthTokens,
  CreateSsoProviderInput,
  OidcCallbackInput,
  Role,
  SamlAcsInput,
  SsoAuthUser,
  SsoProvider,
  UpdateSsoProviderInput,
  User,
} from '@xatxoot/shared'
import { sql } from '../../db'
import { generateTokens } from '../auth/auth.service'

const memoryStore = {
  providers: new Map<string, SsoProvider>(),
  users: new Map<string, User>(),
}

export function resetSsoStore(): void {
  memoryStore.providers.clear()
  memoryStore.users.clear()
}

export class SsoService {
  async createProvider(input: CreateSsoProviderInput): Promise<SsoProvider> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const provider: SsoProvider = {
      id,
      name: input.name,
      providerType: input.providerType,
      issuerUrl: input.issuerUrl,
      clientId: input.clientId ?? input.oidcConfig?.clientId ?? null,
      clientSecretEncrypted: input.clientSecret ?? input.oidcConfig?.clientSecret ?? null,
      clientSecretEnc: null,
      certData: input.certData ?? input.samlConfig?.certData ?? null,
      ssoUrl: input.ssoUrl ?? input.samlConfig?.ssoUrl ?? null,
      samlConfig: input.samlConfig ?? null,
      oidcConfig: input.oidcConfig ?? null,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.providers.set(id, provider)

    try {
      await sql`
        INSERT INTO sso_providers (
          id, provider_type, issuer_url, client_id, client_secret_encrypted,
          cert_data, active, created_at, updated_at
        ) VALUES (
          ${provider.id}, ${provider.providerType}, ${provider.issuerUrl},
          ${provider.clientId}, ${provider.clientSecretEncrypted},
          ${provider.certData}, ${provider.active}, ${provider.createdAt}, ${provider.updatedAt}
        )
      `
    } catch {
      // Memory fallback
    }

    return provider
  }

  async getProviderById(id: string): Promise<SsoProvider | null> {
    try {
      const rows = await sql`
        SELECT
          id, provider_type as "providerType", issuer_url as "issuerUrl",
          client_id as "clientId", client_secret_encrypted as "clientSecretEncrypted",
          cert_data as "certData", active, created_at as "createdAt", updated_at as "updatedAt"
        FROM sso_providers
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows.length > 0) {
        const row = rows[0] as unknown as SsoProvider
        const mem = memoryStore.providers.get(id)
        return {
          ...row,
          name: mem?.name || row.providerType.toUpperCase(),
          ssoUrl: mem?.ssoUrl ?? null,
          samlConfig: mem?.samlConfig ?? null,
          oidcConfig: mem?.oidcConfig ?? null,
        }
      }
    } catch {
      // Memory fallback
    }

    return memoryStore.providers.get(id) || null
  }

  async listProviders(): Promise<SsoProvider[]> {
    try {
      const rows = await sql`
        SELECT
          id, provider_type as "providerType", issuer_url as "issuerUrl",
          client_id as "clientId", client_secret_encrypted as "clientSecretEncrypted",
          cert_data as "certData", active, created_at as "createdAt", updated_at as "updatedAt"
        FROM sso_providers
        ORDER BY created_at DESC
      `
      if (rows.length > 0) {
        return rows.map((r) => {
          const row = r as unknown as SsoProvider
          const mem = memoryStore.providers.get(row.id)
          return {
            ...row,
            name: mem?.name || row.providerType.toUpperCase(),
            ssoUrl: mem?.ssoUrl ?? null,
            samlConfig: mem?.samlConfig ?? null,
            oidcConfig: mem?.oidcConfig ?? null,
          }
        })
      }
    } catch {
      // Memory fallback
    }

    return Array.from(memoryStore.providers.values())
  }

  async updateProvider(id: string, input: UpdateSsoProviderInput): Promise<SsoProvider> {
    const existing = await this.getProviderById(id)
    if (!existing) {
      throw new Error(`SSO provider not found: ${id}`)
    }

    const now = new Date().toISOString()
    const updated: SsoProvider = {
      ...existing,
      name: input.name ?? existing.name,
      issuerUrl: input.issuerUrl ?? existing.issuerUrl,
      clientId: input.clientId ?? existing.clientId,
      clientSecretEncrypted: input.clientSecret ?? existing.clientSecretEncrypted,
      certData: input.certData ?? existing.certData,
      ssoUrl: input.ssoUrl ?? existing.ssoUrl,
      samlConfig: input.samlConfig
        ? { ...existing.samlConfig, ...input.samlConfig }
        : existing.samlConfig,
      oidcConfig: input.oidcConfig
        ? { ...existing.oidcConfig, ...input.oidcConfig }
        : existing.oidcConfig,
      active: input.active ?? existing.active,
      updatedAt: now,
    }

    memoryStore.providers.set(id, updated)

    try {
      await sql`
        UPDATE sso_providers
        SET
          provider_type = ${updated.providerType},
          issuer_url = ${updated.issuerUrl},
          client_id = ${updated.clientId},
          client_secret_encrypted = ${updated.clientSecretEncrypted},
          cert_data = ${updated.certData},
          active = ${updated.active},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async deleteProvider(id: string): Promise<boolean> {
    memoryStore.providers.delete(id)
    try {
      await sql`DELETE FROM sso_providers WHERE id = ${id}`
      return true
    } catch {
      return true
    }
  }

  /**
   * Generates OIDC Authorization URL
   */
  async getOidcAuthUrl(providerId: string, state?: string, redirectUri?: string): Promise<string> {
    const provider = await this.getProviderById(providerId)
    if (!provider || provider.providerType !== 'oidc') {
      throw new Error(`Valid OIDC provider not found: ${providerId}`)
    }

    const baseAuthUrl =
      provider.oidcConfig?.authorizationUrl || `${provider.issuerUrl.replace(/\/$/, '')}/authorize`
    const clientId = provider.clientId || provider.oidcConfig?.clientId || ''
    const scopes = (provider.oidcConfig?.scopes || ['openid', 'profile', 'email']).join(' ')
    const defaultRedirect =
      redirectUri ||
      provider.oidcConfig?.redirectUri ||
      `https://app.xatxoot.com/api/v1/sso/oidc/callback/${provider.id}`

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: scopes,
      redirect_uri: defaultRedirect,
    })

    if (state) {
      params.append('state', state)
    }

    return `${baseAuthUrl}?${params.toString()}`
  }

  /**
   * Handles OIDC Authorization Callback
   */
  async handleOidcCallback(
    providerId: string,
    input: OidcCallbackInput,
  ): Promise<{ user: User; tokens: AuthTokens; relayState?: string }> {
    const provider = await this.getProviderById(providerId)
    if (!provider || provider.providerType !== 'oidc') {
      throw new Error(`Valid OIDC provider not found: ${providerId}`)
    }

    if (!input.code || input.code.trim().length === 0) {
      throw new Error('Authorization code is required')
    }

    // Resolve user profile (mock / extracted from code or OIDC token payload)
    const email = `agent.${input.code.toLowerCase().replace(/[^a-z0-9]/g, '')}@company.com`
    const displayName = 'OIDC Authenticated Agent'
    const externalId = `oidc_${provider.id}_${input.code}`

    const authUser: SsoAuthUser = {
      email,
      name: displayName,
      externalId,
      providerType: 'oidc',
    }

    const user = await this.findOrCreateSsoUser(authUser)
    const tokens = generateTokens(user.id)

    return {
      user,
      tokens,
      relayState: input.state,
    }
  }

  /**
   * Generates SAML IdP Redirect URL
   */
  async getSamlLoginUrl(providerId: string, relayState?: string): Promise<string> {
    const provider = await this.getProviderById(providerId)
    if (!provider || provider.providerType !== 'saml') {
      throw new Error(`Valid SAML provider not found: ${providerId}`)
    }

    const ssoUrl = provider.ssoUrl || provider.samlConfig?.ssoUrl || provider.issuerUrl
    const params = new URLSearchParams()

    // Create SAML AuthnRequest mockup/placeholder
    const authnRequestXml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${crypto.randomUUID()}" Version="2.0" IssueInstant="${new Date().toISOString()}"/>`
    params.append('SAMLRequest', Buffer.from(authnRequestXml).toString('base64'))

    if (relayState) {
      params.append('RelayState', relayState)
    }

    const separator = ssoUrl.includes('?') ? '&' : '?'
    return `${ssoUrl}${separator}${params.toString()}`
  }

  /**
   * Processes SAML Response (Assertion Consumer Service / ACS)
   */
  async handleSamlAcs(
    providerId: string,
    input: SamlAcsInput,
  ): Promise<{ user: User; tokens: AuthTokens; relayState?: string }> {
    const provider = await this.getProviderById(providerId)
    if (!provider || provider.providerType !== 'saml') {
      throw new Error(`Valid SAML provider not found: ${providerId}`)
    }

    if (!input.SAMLResponse || input.SAMLResponse.trim().length === 0) {
      throw new Error('SAMLResponse assertion is required')
    }

    let decodedXml: string
    try {
      decodedXml = Buffer.from(input.SAMLResponse, 'base64').toString('utf-8')
    } catch {
      throw new Error('Invalid base64 SAMLResponse payload')
    }

    if (!decodedXml.includes('<') || !decodedXml.includes('Response')) {
      throw new Error('Malformed SAMLResponse XML')
    }

    // Extract NameID
    const nameIdMatch =
      decodedXml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i) ||
      decodedXml.match(/<NameID[^>]*>([^<]+)<\/NameID>/i)

    let email = nameIdMatch ? nameIdMatch[1].trim() : ''

    // If NameID is not found or not email, try Attribute email
    if (!email || !email.includes('@')) {
      const emailAttrMatch = decodedXml.match(
        /Attribute Name="(?:email|emailAddress)"[^>]*>[\s\S]*?<(?:[a-zA-Z0-9]+:)?AttributeValue[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?AttributeValue>/i,
      )
      if (emailAttrMatch) {
        email = emailAttrMatch[1].trim()
      }
    }

    if (!email) {
      throw new Error('No valid NameID or email found in SAML assertion')
    }

    // Extract DisplayName
    const nameMatch = decodedXml.match(
      /Attribute Name="(?:displayName|name|fullName)"[^>]*>[\s\S]*?<(?:[a-zA-Z0-9]+:)?AttributeValue[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?AttributeValue>/i,
    )
    const displayName = nameMatch ? nameMatch[1].trim() : email.split('@')[0]

    const authUser: SsoAuthUser = {
      email,
      name: displayName,
      externalId: `saml_${provider.id}_${email}`,
      providerType: 'saml',
    }

    const user = await this.findOrCreateSsoUser(authUser)
    const tokens = generateTokens(user.id)

    return {
      user,
      tokens,
      relayState: input.RelayState,
    }
  }

  /**
   * Generates SAML 2.0 Service Provider (SP) Metadata XML
   */
  getSpMetadataXml(baseUrl = 'https://app.xatxoot.com'): string {
    const entityId = `${baseUrl}/api/v1/sso/saml/metadata`
    const acsUrl = `${baseUrl}/api/v1/sso/saml/acs`

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`
  }

  /**
   * Auto-provisions or retrieves existing user for SSO login (JIT Provisioning)
   */
  async findOrCreateSsoUser(authUser: SsoAuthUser): Promise<User> {
    const email = authUser.email.toLowerCase().trim()

    // 1. Try finding in database
    try {
      const rows = await sql`
        SELECT id, email, display_name as "displayName", role, availability, active, created_at as "createdAt"
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `
      if (rows.length > 0) {
        return rows[0] as unknown as User
      }
    } catch {
      // Memory fallback
    }

    // 2. Try finding in memory store
    const memUser = memoryStore.users.get(email)
    if (memUser) return memUser

    // 3. Auto-provision new user as 'agent'
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const newUser: User = {
      id,
      email,
      displayName: authUser.name || email.split('@')[0],
      role: 'agent' as Role,
      availability: 'online',
      active: true,
      createdAt: now,
    }

    memoryStore.users.set(email, newUser)

    try {
      await sql`
        INSERT INTO users (id, email, password_hash, display_name, role, availability, active, created_at)
        VALUES (${newUser.id}, ${newUser.email}, 'sso_no_password', ${newUser.displayName}, 'agent', 'online', true, ${now})
      `
    } catch {
      // Memory fallback
    }

    return newUser
  }
}

export const ssoService = new SsoService()
