import { CreateUserInputSchema, UpdateUserInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { usersService } from './users.service'

export async function handleListUsers(c: Context) {
  try {
    const users = await usersService.listUsers()
    return c.json({ success: true, data: users }, 200)
  } catch (error) {
    return c.json({ error: (error as Error).message || 'Failed to list users' }, 500)
  }
}

export async function handleGetUser(c: Context) {
  try {
    const id = c.req.param('id')
    const user = await usersService.getUserById(id)
    if (!user) {
      return c.json({ error: 'User tidak ditemukan' }, 404)
    }
    return c.json({ success: true, data: user }, 200)
  } catch (error) {
    return c.json({ error: (error as Error).message || 'Failed to get user' }, 500)
  }
}

export async function handleCreateUser(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateUserInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: 'Validasi gagal',
          details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        400,
      )
    }

    const created = await usersService.createUser(parsed.data)
    return c.json({ success: true, data: created }, 201)
  } catch (error) {
    const msg = (error as Error).message || ''
    if (msg.includes('sudah terdaftar')) {
      return c.json({ error: msg }, 409)
    }
    return c.json({ error: msg || 'Failed to create user' }, 500)
  }
}

export async function handleUpdateUser(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const parsed = UpdateUserInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          error: 'Validasi gagal',
          details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        400,
      )
    }

    const updated = await usersService.updateUser(id, parsed.data)
    return c.json({ success: true, data: updated }, 200)
  } catch (error) {
    const msg = (error as Error).message || ''
    if (msg.includes('tidak ditemukan')) {
      return c.json({ error: msg }, 404)
    }
    return c.json({ error: msg || 'Failed to update user' }, 500)
  }
}

export async function handleDeleteUser(c: Context) {
  try {
    const id = c.req.param('id')
    const success = await usersService.deleteUser(id)
    if (!success) {
      return c.json({ error: 'User tidak ditemukan' }, 404)
    }
    return c.json({ success: true, message: 'User berhasil dinonaktifkan' }, 200)
  } catch (error) {
    return c.json({ error: (error as Error).message || 'Failed to delete user' }, 500)
  }
}
