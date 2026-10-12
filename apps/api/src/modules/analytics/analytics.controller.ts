import { type ReportFilterQuery, ReportFilterQueryRawSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { analyticsService } from './analytics.service'

export class AnalyticsController {
  async getSummary(c: Context) {
    try {
      const query = c.req.query()
      const parsed = ReportFilterQueryRawSchema.safeParse(query)
      const filter: ReportFilterQuery = parsed.success ? parsed.data : {}

      const data = await analyticsService.getMetricsSummary(filter)
      return c.json({ success: true, data })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch summary metrics',
        },
        500,
      )
    }
  }

  async getTimeSeries(c: Context) {
    try {
      const query = c.req.query()
      const parsed = ReportFilterQueryRawSchema.safeParse(query)
      const filter: ReportFilterQuery = parsed.success ? parsed.data : {}

      const data = await analyticsService.getTimeSeries(filter)
      return c.json({ success: true, data })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch time series metrics',
        },
        500,
      )
    }
  }

  async getAgents(c: Context) {
    try {
      const query = c.req.query()
      const parsed = ReportFilterQueryRawSchema.safeParse(query)
      const filter: ReportFilterQuery = parsed.success ? parsed.data : {}

      const data = await analyticsService.getAgentPerformance(filter)
      return c.json({ success: true, data })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch agent performance',
        },
        500,
      )
    }
  }

  async exportCsv(c: Context) {
    try {
      const query = c.req.query()
      const parsed = ReportFilterQueryRawSchema.safeParse(query)
      const filter = {
        ...(parsed.success ? parsed.data : {}),
        type: query.type,
      }

      const csvContent = await analyticsService.exportCsv(filter)
      const filename = `report-export-${Date.now()}.csv`

      c.header('Content-Type', 'text/csv; charset=utf-8')
      c.header('Content-Disposition', `attachment; filename="${filename}"`)

      return c.body(csvContent, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to export reports',
        },
        500,
      )
    }
  }

  async createEvent(c: Context) {
    try {
      const body = await c.req.json()
      const event = await analyticsService.recordEvent(body)
      return c.json({ success: true, data: event }, 201)
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create reporting event',
        },
        400,
      )
    }
  }
}

export const analyticsController = new AnalyticsController()
