import { Hono } from 'hono'
import { automationRulesController } from './automation-rules.controller'

export const automationRoutes = new Hono()

automationRoutes.get('/', (c) => automationRulesController.listRules(c))
automationRoutes.post('/', (c) => automationRulesController.createRule(c))
automationRoutes.get('/:id', (c) => automationRulesController.getRule(c))
automationRoutes.patch('/:id', (c) => automationRulesController.updateRule(c))
automationRoutes.delete('/:id', (c) => automationRulesController.deleteRule(c))
automationRoutes.post('/evaluate', (c) => automationRulesController.evaluate(c))
