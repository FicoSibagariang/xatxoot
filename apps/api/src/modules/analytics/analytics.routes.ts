import { Hono } from 'hono'
import { analyticsController } from './analytics.controller'

export const reportRoutes = new Hono()

reportRoutes.get('/summary', (c) => analyticsController.getSummary(c))
reportRoutes.get('/time-series', (c) => analyticsController.getTimeSeries(c))
reportRoutes.get('/agents', (c) => analyticsController.getAgents(c))
reportRoutes.get('/export', (c) => analyticsController.exportCsv(c))
reportRoutes.post('/events', (c) => analyticsController.createEvent(c))
