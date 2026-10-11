import { Hono } from 'hono'
import { businessHoursController } from './business-hours.controller'

export const businessHoursRoutes = new Hono()
businessHoursRoutes.post('/evaluate', businessHoursController.handleEvaluate)

export const inboxBusinessHoursRoutes = new Hono()
inboxBusinessHoursRoutes.get('/:inboxId/business-hours', businessHoursController.handleGetByInbox)
inboxBusinessHoursRoutes.post(
  '/:inboxId/business-hours',
  businessHoursController.handleUpsertByInbox,
)

export default businessHoursRoutes
