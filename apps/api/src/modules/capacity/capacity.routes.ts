import { Hono } from 'hono'
import { capacityController } from './capacity.controller'

export const capacityRoutes = new Hono()

// Capacity Policies CRUD
capacityRoutes.get('/policies', (c) => capacityController.listPolicies(c))
capacityRoutes.post('/policies', (c) => capacityController.createPolicy(c))
capacityRoutes.get('/policies/:id', (c) => capacityController.getPolicy(c))
capacityRoutes.put('/policies/:id', (c) => capacityController.updatePolicy(c))
capacityRoutes.delete('/policies/:id', (c) => capacityController.deletePolicy(c))

// Agent Workload & Override Management
capacityRoutes.get('/workload', (c) => capacityController.getWorkloadOverview(c))
capacityRoutes.get('/agents/:agentId', (c) => capacityController.getAgentCapacity(c))
capacityRoutes.post('/agents/:agentId/override', (c) => capacityController.setAgentOverride(c))
