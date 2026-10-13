import {
  CreateSsoProviderInputSchema,
  OidcCallbackInputSchema,
  SamlAcsInputSchema,
  UpdateSsoProviderInputSchema,
} from '@xatxoot/shared'
import type { Context } from 'hono'
import { ssoService } from './sso.service'

export class SsoController {
  async listProviders(c: Context) {
    const providers = await ssoService.listProviders()
    return c.json(providers)
  }

  async getProvider(c: Context) {
    const id = c.req.param('id')
    const provider = await ssoService.getProviderById(id)
    if (!provider) {
      return c.json({ error: 'SSO provider not found' }, 404)
    }
    return c.json(provider)
  }

  async createProvider(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = CreateSsoProviderInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Validation error', details: parsed.error.issues }, 400)
      }

      const provider = await ssoService.createProvider(parsed.data)
      return c.json(provider, 201)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create SSO provider'
      return c.json({ error: message }, 500)
    }
  }

  async updateProvider(c: Context) {
    try {
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = UpdateSsoProviderInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Validation error', details: parsed.error.issues }, 400)
      }

      const updated = await ssoService.updateProvider(id, parsed.data)
      return c.json(updated)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update SSO provider'
      return c.json({ error: message }, 500)
    }
  }

  async deleteProvider(c: Context) {
    const id = c.req.param('id')
    const success = await ssoService.deleteProvider(id)
    return c.json({ success })
  }

  async oidcLogin(c: Context) {
    try {
      const providerId = c.req.param('providerId')
      const state = c.req.query('state') || crypto.randomUUID()
      const authUrl = await ssoService.getOidcAuthUrl(providerId, state)

      // Support direct redirect or JSON response
      if (c.req.header('Accept')?.includes('application/json')) {
        return c.json({ authUrl, state })
      }
      return c.redirect(authUrl)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize OIDC login'
      return c.json({ error: message }, 500)
    }
  }

  async oidcCallback(c: Context) {
    try {
      const providerId = c.req.param('providerId')
      let body: Record<string, unknown> = {}

      if (c.req.method === 'POST') {
        body = await c.req.json().catch(() => ({}))
      } else {
        body = {
          code: c.req.query('code'),
          state: c.req.query('state'),
        }
      }

      const parsed = OidcCallbackInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Validation error', details: parsed.error.issues }, 400)
      }

      const result = await ssoService.handleOidcCallback(providerId, parsed.data)
      return c.json(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to handle OIDC callback'
      return c.json({ error: message }, 500)
    }
  }

  async samlLogin(c: Context) {
    try {
      const providerId = c.req.param('providerId')
      const relayState = c.req.query('RelayState') || c.req.query('relayState')
      const loginUrl = await ssoService.getSamlLoginUrl(providerId, relayState)

      if (c.req.header('Accept')?.includes('application/json')) {
        return c.json({ loginUrl, relayState })
      }
      return c.redirect(loginUrl)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize SAML login'
      return c.json({ error: message }, 500)
    }
  }

  async samlAcs(c: Context) {
    try {
      const providerId = c.req.param('providerId')
      let body: Record<string, unknown> = {}

      const contentType = c.req.header('Content-Type') || ''
      if (contentType.includes('application/json')) {
        body = await c.req.json().catch(() => ({}))
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await c.req.parseBody().catch(() => ({}))
        body = {
          SAMLResponse: formData.SAMLResponse,
          RelayState: formData.RelayState,
        }
      } else {
        body = await c.req.json().catch(() => ({}))
      }

      const parsed = SamlAcsInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Validation error', details: parsed.error.issues }, 400)
      }

      const result = await ssoService.handleSamlAcs(providerId, parsed.data)
      return c.json(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process SAML assertion'
      return c.json({ error: message }, 500)
    }
  }

  samlMetadata(c: Context) {
    const host = c.req.header('Host') || 'app.xatxoot.com'
    const protocol = c.req.header('X-Forwarded-Proto') || 'https'
    const baseUrl = `${protocol}://${host}`
    const xml = ssoService.getSpMetadataXml(baseUrl)

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    })
  }
}

export const ssoController = new SsoController()
