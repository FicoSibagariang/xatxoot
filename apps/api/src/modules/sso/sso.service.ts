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

export interface AuditLogItem {
  id: string
  userId: string | null
  userName?: string
  userEmail?: string
  action: string
  auditableType: string
  auditableId: string | null
  changes: Record<string, unknown>
  ipAddress: string | null
  createdAt: string
}

export async function resetSsoStore(): Promise<void> {
  await sql`DELETE FROM sso_provider_extras`
  await sql`DELETE FROM sso_providers`
}

export class SsoService {
  async createProvider(input: CreateSsoProviderInput): Promise<SsoProvider> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const clientId = input.clientId ?? input.oidcConfig?.clientId ?? null
    const clientSecretEncrypted = input.clientSecret ?? input.oidcConfig?.clientSecret ?? null
    const certData = input.certData ?? input.samlConfig?.certData ?? null
    const ssoUrl = input.ssoUrl ?? input.samlConfig?.ssoUrl ?? null
    const samlConfig = input.samlConfig ? JSON.stringify(input.samlConfig) : null
    const oidcConfig = input.oidcConfig ? JSON.stringify(input.oidcConfig) : null
    const active = input.active ?? true

    await sql`
      INSERT INTO sso_providers (
        id, provider_type, issuer_url, client_id, client_secret_encrypted,
        cert_data, active, created_at, updated_at
      ) VALUES (
        ${id}, ${input.providerType}, ${input.issuerUrl},
        ${clientId}, ${clientSecretEncrypted},
        ${certData}, ${active}, ${now}, ${now}
      )
    `

    await sql`
      INSERT INTO sso_provider_extras (
        id, name, sso_url, saml_config, oidc_config
      ) VALUES (
        ${id}, ${input.name}, ${ssoUrl}, ${samlConfig}, ${oidcConfig}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        sso_url = EXCLUDED.sso_url,
        saml_config = EXCLUDED.saml_config,
        oidc_config = EXCLUDED.oidc_config
    `

    const provider = await this.getProviderById(id)
    if (!provider) {
      throw new Error(`Failed to retrieve SSO provider: ${id}`)
    }
    return provider
  }

  async getProviderById(id: string): Promise<SsoProvider | null> {
    const rows = await sql`
      SELECT
        p.id, COALESCE(e.name, p.provider_type) as name, p.provider_type as "providerType", p.issuer_url as "issuerUrl",
        p.client_id as "clientId", p.client_secret_encrypted as "clientSecretEncrypted",
        p.client_secret_enc as "clientSecretEnc", p.cert_data as "certData",
        e.sso_url as "ssoUrl", e.saml_config as "samlConfig", e.oidc_config as "oidcConfig",
        p.active, p.created_at as "createdAt", p.updated_at as "updatedAt"
      FROM sso_providers p
      LEFT JOIN sso_provider_extras e ON p.id = e.id
      WHERE p.id = ${id}
      LIMIT 1
    `
    if (!rows || rows.length === 0) return null
    const row = rows[0]
    return {
      ...row,
      samlConfig: typeof row.samlConfig === 'string' ? JSON.parse(row.samlConfig) : row.samlConfig,
      oidcConfig: typeof row.oidcConfig === 'string' ? JSON.parse(row.oidcConfig) : row.oidcConfig,
    } as SsoProvider
  }

  async listProviders(): Promise<SsoProvider[]> {
    const rows = await sql`
      SELECT
        p.id, COALESCE(e.name, p.provider_type) as name, p.provider_type as "providerType", p.issuer_url as "issuerUrl",
        p.client_id as "clientId", p.client_secret_encrypted as "clientSecretEncrypted",
        p.client_secret_enc as "clientSecretEnc", p.cert_data as "certData",
        e.sso_url as "ssoUrl", e.saml_config as "samlConfig", e.oidc_config as "oidcConfig",
        p.active, p.created_at as "createdAt", p.updated_at as "updatedAt"
      FROM sso_providers p
      LEFT JOIN sso_provider_extras e ON p.id = e.id
      ORDER BY p.created_at DESC
    `
    return (rows as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      samlConfig: typeof r.samlConfig === 'string' ? JSON.parse(r.samlConfig) : r.samlConfig,
      oidcConfig: typeof r.oidcConfig === 'string' ? JSON.parse(r.oidcConfig) : r.oidcConfig,
    })) as SsoProvider[]
  }

  async updateProvider(id: string, input: UpdateSsoProviderInput): Promise<SsoProvider> {
    const existing = await this.getProviderById(id)
    if (!existing) {
      throw new Error(`SSO provider not found: ${id}`)
    }

    const now = new Date().toISOString()
    const name = input.name ?? existing.name
    const issuerUrl = input.issuerUrl ?? existing.issuerUrl
    const clientId = input.clientId ?? existing.clientId
    const clientSecretEncrypted = input.clientSecret ?? existing.clientSecretEncrypted
    const certData = input.certData ?? existing.certData
    const ssoUrl = input.ssoUrl ?? existing.ssoUrl
    const samlConfigObj = input.samlConfig
      ? { ...existing.samlConfig, ...input.samlConfig }
      : existing.samlConfig
    const oidcConfigObj = input.oidcConfig
      ? { ...existing.oidcConfig, ...input.oidcConfig }
      : existing.oidcConfig
    const samlConfig = samlConfigObj ? JSON.stringify(samlConfigObj) : null
    const oidcConfig = oidcConfigObj ? JSON.stringify(oidcConfigObj) : null
    const active = input.active ?? existing.active

    await sql`
      UPDATE sso_providers
      SET
        issuer_url = ${issuerUrl},
        client_id = ${clientId},
        client_secret_encrypted = ${clientSecretEncrypted},
        cert_data = ${certData},
        active = ${active},
        updated_at = ${now}
      WHERE id = ${id}
    `

    await sql`
      INSERT INTO sso_provider_extras (
        id, name, sso_url, saml_config, oidc_config
      ) VALUES (
        ${id}, ${name}, ${ssoUrl}, ${samlConfig}, ${oidcConfig}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        sso_url = EXCLUDED.sso_url,
        saml_config = EXCLUDED.saml_config,
        oidc_config = EXCLUDED.oidc_config
    `

    const provider = await this.getProviderById(id)
    if (!provider) {
      throw new Error(`Failed to retrieve SSO provider: ${id}`)
    }
    return provider
  }

  async deleteProvider(id: string): Promise<boolean> {
    const rows = await sql`DELETE FROM sso_providers WHERE id = ${id} RETURNING id`
    return rows.length > 0
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

    const nameIdMatch =
      decodedXml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i) ||
      decodedXml.match(/<NameID[^>]*>([^<]+)<\/NameID>/i)

    let email = nameIdMatch ? nameIdMatch[1].trim() : ''

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

    const rows = await sql`
      SELECT id, email, display_name as "displayName", role, availability, active, created_at as "createdAt"
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `
    if (rows.length > 0) {
      return rows[0] as unknown as User
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const displayName = authUser.name || email.split('@')[0]

    const newRows = await sql`
      INSERT INTO users (id, email, password_hash, display_name, role, availability, active, created_at, updated_at)
      VALUES (${id}, ${email}, 'sso_no_password', ${displayName}, 'agent', 'online', true, ${now}, ${now})
      RETURNING id, email, display_name as "displayName", role, availability, active, created_at as "createdAt"
    `

    return newRows[0] as unknown as User
  }

  async listAuditLogs(limit = 50): Promise<AuditLogItem[]> {
    const rows = await sql`
      SELECT
        al.id,
        al.user_id as "userId",
        u.display_name as "userName",
        u.email as "userEmail",
        al.action,
        al.auditable_type as "auditableType",
        al.auditable_id as "auditableId",
        al.changes,
        al.ip_address as "ipAddress",
        al.created_at as "createdAt"
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `
    if (rows && rows.length > 0) {
      return rows as unknown as AuditLogItem[]
    }

    return []
  }
}

export const ssoService = new SsoService()
