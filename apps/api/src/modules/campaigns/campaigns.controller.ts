import { CreateCampaignInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { broadcastEngine, campaignsService } from './campaigns.service'

export class CampaignsController {
  async createCampaign(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = CreateCampaignInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
          400,
        )
      }

      const campaign = await campaignsService.createCampaign(parsed.data)
      return c.json({ success: true, data: campaign }, 201)
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async listCampaigns(c: Context) {
    const inboxId = c.req.query('inboxId')
    const status = c.req.query('status')
    const data = await campaignsService.listCampaigns({
      inboxId: inboxId || undefined,
      status: status || undefined,
    })
    return c.json({ success: true, data })
  }

  async getCampaign(c: Context) {
    const id = c.req.param('id')
    const data = await campaignsService.getCampaignWithStats(id)
    if (!data) {
      return c.json({ success: false, error: 'Campaign not found' }, 404)
    }
    return c.json({ success: true, data })
  }

  async listDeliveries(c: Context) {
    const id = c.req.param('id')
    const data = await campaignsService.listCampaignDeliveries(id)
    return c.json({ success: true, data })
  }

  async dispatchCampaign(c: Context) {
    try {
      const id = c.req.param('id')
      await broadcastEngine.enqueueCampaignDispatch(id)
      const result = await broadcastEngine.processCampaignDispatch(id)
      return c.json({ success: true, data: result })
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async cancelCampaign(c: Context) {
    try {
      const id = c.req.param('id')
      const data = await campaignsService.cancelCampaign(id)
      return c.json({ success: true, data })
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }
}

export const campaignsController = new CampaignsController()
