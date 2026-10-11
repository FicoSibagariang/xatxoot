import {
  CreateSlashCommandInputSchema,
  ExecuteSlashCommandInputSchema,
  UpdateSlashCommandInputSchema,
} from '@xatxoot/shared'
import type { Context } from 'hono'
import { SlashCommandTimeoutError, slashCommandService } from './slash-commands.service'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handleListSlashCommands(c: Context) {
  try {
    const search = c.req.query('q') || c.req.query('search')
    const list = await slashCommandService.listSlashCommands(search)
    return c.json({ data: list }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleGetSlashCommand(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'ID slash command tidak valid' }, 400)
    }

    const item = await slashCommandService.getSlashCommandById(id)
    if (!item) {
      return c.json({ error: 'Slash command tidak ditemukan' }, 404)
    }

    return c.json({ data: item }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleCreateSlashCommand(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateSlashCommandInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { error: parsed.error.issues[0]?.message || 'Input slash command tidak valid' },
        400,
      )
    }

    const created = await slashCommandService.createSlashCommand(parsed.data)
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

export async function handleUpdateSlashCommand(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'ID slash command tidak valid' }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = UpdateSlashCommandInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { error: parsed.error.issues[0]?.message || 'Input update slash command tidak valid' },
        400,
      )
    }

    const updated = await slashCommandService.updateSlashCommand(id, parsed.data)
    if (!updated) {
      return c.json({ error: 'Slash command tidak ditemukan' }, 404)
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

export async function handleDeleteSlashCommand(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'ID slash command tidak valid' }, 400)
    }

    const success = await slashCommandService.deleteSlashCommand(id)
    if (!success) {
      return c.json({ error: 'Slash command tidak ditemukan' }, 404)
    }

    return c.json({ data: { success: true } }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleExecuteSlashCommand(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = ExecuteSlashCommandInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: parsed.error.issues[0]?.message || 'Parameter eksekusi slash command tidak valid',
        },
        400,
      )
    }

    const result = await slashCommandService.executeSlashCommand(parsed.data)
    return c.json({ data: result }, 200)
  } catch (err) {
    if (err instanceof SlashCommandTimeoutError) {
      return c.json({ error: err.message }, 504)
    }
    if (err instanceof Error) {
      if (err.message.includes('tidak ditemukan')) {
        return c.json({ error: err.message }, 404)
      }
      return c.json({ error: err.message }, 502)
    }
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}
