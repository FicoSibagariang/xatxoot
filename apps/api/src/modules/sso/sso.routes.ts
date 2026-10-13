import { Hono } from 'hono'
import { ssoController } from './sso.controller'

export const ssoRoutes = new Hono()

// SSO Provider Management CRUD
ssoRoutes.get('/providers', (c) => ssoController.listProviders(c))
ssoRoutes.post('/providers', (c) => ssoController.createProvider(c))
ssoRoutes.get('/providers/:id', (c) => ssoController.getProvider(c))
ssoRoutes.put('/providers/:id', (c) => ssoController.updateProvider(c))
ssoRoutes.delete('/providers/:id', (c) => ssoController.deleteProvider(c))
ssoRoutes.get('/audit-logs', (c) => ssoController.listAuditLogs(c))

// OIDC Flow
ssoRoutes.get('/oidc/login/:providerId', (c) => ssoController.oidcLogin(c))
ssoRoutes.get('/oidc/callback/:providerId', (c) => ssoController.oidcCallback(c))
ssoRoutes.post('/oidc/callback/:providerId', (c) => ssoController.oidcCallback(c))

// SAML 2.0 Flow
ssoRoutes.get('/saml/login/:providerId', (c) => ssoController.samlLogin(c))
ssoRoutes.post('/saml/acs/:providerId', (c) => ssoController.samlAcs(c))
ssoRoutes.get('/saml/metadata', (c) => ssoController.samlMetadata(c))
