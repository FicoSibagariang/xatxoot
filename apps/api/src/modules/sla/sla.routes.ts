import { Hono } from 'hono'
import { slaController } from './sla.controller'

export const slaRoutes = new Hono()

slaRoutes.get('/policies', (c) => slaController.listPolicies(c))
slaRoutes.post('/policies', (c) => slaController.createPolicy(c))
slaRoutes.get('/policies/:id', (c) => slaController.getPolicy(c))
slaRoutes.put('/policies/:id', (c) => slaController.updatePolicy(c))
slaRoutes.delete('/policies/:id', (c) => slaController.deletePolicy(c))

slaRoutes.post('/evaluate', (c) => slaController.evaluate(c))
slaRoutes.get('/tickets/:ticketId/status', (c) => slaController.getTicketSlaStatus(c))
slaRoutes.post('/tickets/:ticketId/attach', (c) => slaController.attachSla(c))
