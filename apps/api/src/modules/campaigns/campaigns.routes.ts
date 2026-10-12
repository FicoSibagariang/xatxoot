import { Hono } from 'hono'
import { campaignsController } from './campaigns.controller'

export const campaignRoutes = new Hono()

campaignRoutes.get('/', (c) => campaignsController.listCampaigns(c))
campaignRoutes.post('/', (c) => campaignsController.createCampaign(c))
campaignRoutes.get('/:id', (c) => campaignsController.getCampaign(c))
campaignRoutes.get('/:id/deliveries', (c) => campaignsController.listDeliveries(c))
campaignRoutes.post('/:id/dispatch', (c) => campaignsController.dispatchCampaign(c))
campaignRoutes.post('/:id/cancel', (c) => campaignsController.cancelCampaign(c))
