import { Hono } from 'hono'
import {
  handleWidgetConfig,
  handleWidgetSendMessage,
  handleWidgetStream,
} from './widget.controller'

export const widgetRoutes = new Hono()

widgetRoutes.post('/messages', handleWidgetSendMessage)
widgetRoutes.get('/stream', handleWidgetStream)
widgetRoutes.get('/config', handleWidgetConfig)

export default widgetRoutes
