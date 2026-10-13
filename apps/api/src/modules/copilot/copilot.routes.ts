import { Hono } from 'hono'
import { copilotController } from './copilot.controller'

export const copilotRoutes = new Hono()

copilotRoutes.post('/action', (c) => copilotController.executeAction(c))
copilotRoutes.post('/summarize', (c) => copilotController.summarize(c))
copilotRoutes.post('/change-tone', (c) => copilotController.changeTone(c))
copilotRoutes.post('/draft-reply', (c) => copilotController.draftReply(c))
copilotRoutes.get('/settings', (c) => copilotController.getSettings(c))
copilotRoutes.put('/settings', (c) => copilotController.updateSettings(c))
