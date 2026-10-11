import { CreateTeamInputSchema, UpdateTeamInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { teamService } from './teams.service'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handleListTeams(c: Context) {
  try {
    const teams = await teamService.listTeams()
    return c.json({ data: teams }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleGetTeam(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'Team ID tidak valid' }, 400)
    }

    const team = await teamService.getTeam(id)
    if (!team) {
      return c.json({ error: 'Tim tidak ditemukan' }, 404)
    }

    return c.json({ data: team }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleCreateTeam(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateTeamInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message || 'Input tim tidak valid' }, 400)
    }

    const created = await teamService.createTeam(parsed.data)
    return c.json({ data: created }, 201)
  } catch (err) {
    if (err instanceof Error) {
      return c.json({ error: err.message }, 400)
    }
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleUpdateTeam(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'Team ID tidak valid' }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = UpdateTeamInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { error: parsed.error.issues[0]?.message || 'Input update tim tidak valid' },
        400,
      )
    }

    const updated = await teamService.updateTeam(id, parsed.data)
    if (!updated) {
      return c.json({ error: 'Tim tidak ditemukan' }, 404)
    }

    return c.json({ data: updated }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleDeleteTeam(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'Team ID tidak valid' }, 400)
    }

    const success = await teamService.deleteTeam(id)
    if (!success) {
      return c.json({ error: 'Tim tidak ditemukan' }, 404)
    }

    return c.json({ data: { success: true } }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleListMembers(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'Team ID tidak valid' }, 400)
    }

    const team = await teamService.getTeam(id)
    if (!team) {
      return c.json({ error: 'Tim tidak ditemukan' }, 404)
    }

    const members = await teamService.listMembers(id)
    return c.json({ data: members }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleAddMember(c: Context) {
  try {
    const id = c.req.param('id')
    if (!UUID_REGEX.test(id)) {
      return c.json({ error: 'Team ID tidak valid' }, 400)
    }

    const team = await teamService.getTeam(id)
    if (!team) {
      return c.json({ error: 'Tim tidak ditemukan' }, 404)
    }

    const body = await c.req.json().catch(() => ({}))
    const userId = body?.userId
    if (!userId || !UUID_REGEX.test(userId)) {
      return c.json({ error: 'User ID tidak valid' }, 400)
    }

    const member = await teamService.addMember(id, userId)
    return c.json({ data: member }, 201)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('already a member')) {
        return c.json({ error: err.message }, 409)
      }
      return c.json({ error: err.message }, 400)
    }
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleRemoveMember(c: Context) {
  try {
    const id = c.req.param('id')
    const userId = c.req.param('userId')
    if (!UUID_REGEX.test(id) || !UUID_REGEX.test(userId)) {
      return c.json({ error: 'ID tidak valid' }, 400)
    }

    const team = await teamService.getTeam(id)
    if (!team) {
      return c.json({ error: 'Tim tidak ditemukan' }, 404)
    }

    const success = await teamService.removeMember(id, userId)
    if (!success) {
      return c.json({ error: 'Anggota tidak ditemukan pada tim' }, 404)
    }

    return c.json({ data: { success: true } }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}
