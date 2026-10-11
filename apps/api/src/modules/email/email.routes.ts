import { Hono } from 'hono'
import { emailController } from './email.controller'

export const emailRoutes = new Hono()

emailRoutes.post('/inbound', emailController.handleInbound)
emailRoutes.post('/outbound', emailController.handleOutbound)
