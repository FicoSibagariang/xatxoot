import { CreateBotFlowInputSchema, UpdateBotFlowInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { botEngineService } from './bots.service'

export async function handleCreateBotFlow(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateBotFlowInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid bot flow input', issues: parsed.error.issues }, 400)
    }

    const flow = await botEngineService.createFlow(parsed.data)
    return c.json({ flow }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleListBotFlows(c: Context) {
  try {
    const flows = await botEngineService.listFlows()
    return c.json({ flows }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleGetBotFlow(c: Context) {
  try {
    const id = c.req.param('id')
    const flow = await botEngineService.getFlowById(id)
    if (!flow) {
      return c.json({ error: 'Bot flow not found' }, 404)
    }
    return c.json({ flow }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleUpdateBotFlow(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const parsed = UpdateBotFlowInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid update input', issues: parsed.error.issues }, 400)
    }

    const flow = await botEngineService.updateFlow(id, parsed.data)
    if (!flow) {
      return c.json({ error: 'Bot flow not found' }, 404)
    }
    return c.json({ flow }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleDeleteBotFlow(c: Context) {
  try {
    const id = c.req.param('id')
    const deleted = await botEngineService.deleteFlow(id)
    if (!deleted) {
      return c.json({ error: 'Bot flow not found' }, 404)
    }
    return c.json({ success: true }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleStartBotSession(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const conversationId = body.conversationId
    const flowId = body.flowId

    if (!conversationId || !flowId) {
      return c.json({ error: 'conversationId and flowId are required' }, 400)
    }

    const session = await botEngineService.startSession(conversationId, flowId, {
      ticketId: body.ticketId,
      initialContext: body.initialContext,
    })

    const output = await botEngineService.getLastExecutionOutput(session.id)

    return c.json(
      {
        session,
        messages: output.messages,
      },
      201,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404)
    }
    return c.json({ error: message }, 500)
  }
}

export async function handleProcessUserInput(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const input = body.input

    if (input === undefined || input === null) {
      return c.json({ error: 'input is required' }, 400)
    }

    const result = await botEngineService.processUserInput(id, String(input))
    return c.json(result, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404)
    }
    return c.json({ error: message }, 500)
  }
}

export async function handleGetBotSession(c: Context) {
  try {
    const id = c.req.param('id')
    const session = await botEngineService.getSessionById(id)
    if (!session) {
      return c.json({ error: 'Bot session not found' }, 404)
    }
    const output = await botEngineService.getLastExecutionOutput(id)
    return c.json({ session, messages: output.messages }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}
