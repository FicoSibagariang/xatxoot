import { CreateContactInputSchema, UpdateContactInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { contactService } from './contacts.service'

export async function handleListContacts(c: Context) {
  try {
    const contacts = await contactService.listContacts()
    return c.json(contacts, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleGetContact(c: Context) {
  try {
    const id = c.req.param('id')
    const contact = await contactService.getContactById(id)
    if (!contact) {
      return c.json({ error: 'Kontak tidak ditemukan' }, 404)
    }
    return c.json(contact, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleCreateContact(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parseResult = CreateContactInputSchema.safeParse(body)
    if (!parseResult.success) {
      return c.json(
        {
          error: 'Validasi gagal',
          details: parseResult.error.format(),
        },
        400,
      )
    }

    const created = await contactService.createContact(parseResult.data)
    return c.json(created, 201)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleUpdateContact(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))

    const parseResult = UpdateContactInputSchema.safeParse(body)
    if (!parseResult.success) {
      return c.json(
        {
          error: 'Validasi gagal',
          details: parseResult.error.format(),
        },
        400,
      )
    }

    const updated = await contactService.updateContact(id, parseResult.data)
    if (!updated) {
      return c.json({ error: 'Kontak tidak ditemukan' }, 404)
    }

    return c.json(updated, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}
