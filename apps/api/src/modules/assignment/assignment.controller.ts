import { UpdateUserAvailabilityInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { assignmentService } from './assignment.service'

export async function handleAutoAssignTicket(c: Context) {
  try {
    const idParam = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const ticketId = idParam || body.ticketId

    if (!ticketId) {
      return c.json({ error: 'ticketId is required' }, 400)
    }

    const inboxId = body.inboxId
    const teamId = body.teamId

    const result = await assignmentService.assignTicketRoundRobin(ticketId, {
      inboxId,
      teamId,
    })

    return c.json(
      {
        ticket: result.ticket,
        assignedAgentId: result.assignedAgentId,
        poolKey: result.poolKey,
        success: result.success,
        reason: result.reason,
      },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404)
    }
    return c.json({ error: message }, 500)
  }
}

export async function handleGetNextRoundRobin(c: Context) {
  try {
    const inboxId = c.req.query('inboxId')
    const teamId = c.req.query('teamId')

    const result = await assignmentService.getNextRoundRobinAgent({
      inboxId,
      teamId,
    })

    return c.json(
      {
        nextAgentId: result.nextAgent?.id || null,
        nextAgent: result.nextAgent,
        eligibleCount: result.eligibleCount,
        poolKey: result.poolKey,
        reason: result.reason,
      },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleUpdateUserAvailability(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))

    const parsed = UpdateUserAvailabilityInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid input',
          issues: parsed.error.issues,
        },
        400,
      )
    }

    const user = await assignmentService.setUserAvailability(id, parsed.data.availability)

    return c.json({ user }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}
