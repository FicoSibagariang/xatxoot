import { CreateCannedResponseInputSchema, UpdateCannedResponseInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { cannedResponseService } from './canned-responses.service'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handleListCannedResponses(c: Context) {
  try {
    const query = c.req.query('q') || c.req.query('search') || c.req.query('prefix')
    const list = await cannedResponseService.listCannedResponses(query)
    return c.json({ data: list }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleGetCannedResponse(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'ID canned response tidak valid' }, 400)
    }

    const item = await cannedResponseService.getCannedResponseById(id)
    if (!item) {
      return c.json({ error: 'Canned response tidak ditemukan' }, 404)
    }

    return c.json({ data: item }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleCreateCannedResponse(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateCannedResponseInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { error: parsed.error.issues[0]?.message || 'Input canned response tidak valid' },
        400,
      )
    }

    const created = await cannedResponseService.createCannedResponse(parsed.data)
    return c.json({ data: created }, 201)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('sudah digunakan')) {
        return c.json({ error: err.message }, 409)
      }
      return c.json({ error: err.message }, 400)
    }
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleUpdateCannedResponse(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'ID canned response tidak valid' }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = UpdateCannedResponseInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { error: parsed.error.issues[0]?.message || 'Input update canned response tidak valid' },
        400,
      )
    }

    const updated = await cannedResponseService.updateCannedResponse(id, parsed.data)
    if (!updated) {
      return c.json({ error: 'Canned response tidak ditemukan' }, 404)
    }

    return c.json({ data: updated }, 200)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('sudah digunakan')) {
        return c.json({ error: err.message }, 409)
      }
      return c.json({ error: err.message }, 400)
    }
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleDeleteCannedResponse(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'ID canned response tidak valid' }, 400)
    }

    const success = await cannedResponseService.deleteCannedResponse(id)
    if (!success) {
      return c.json({ error: 'Canned response tidak ditemukan' }, 404)
    }

    return c.json({ data: { success: true } }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}
