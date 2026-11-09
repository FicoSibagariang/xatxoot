import type { Contact, CreateContactInput, UpdateContactInput } from '@xatxoot/shared'
import { CONTACT_COLUMNS, mapRowToContact, sql } from '../../db'

export async function resetContactStore(): Promise<void> {
  await sql`DELETE FROM messages`
  await sql`DELETE FROM tickets`
  await sql`DELETE FROM conversations`
  await sql`DELETE FROM contact_inboxes`
  await sql`DELETE FROM contacts`
}

export class ContactService {
  async listContacts(): Promise<Contact[]> {
    const rows = await sql`
      SELECT ${CONTACT_COLUMNS}
      FROM contacts
      WHERE deleted_at IS NULL
      ORDER BY updated_at DESC
    `
    return rows.map(mapRowToContact)
  }

  async getContactById(id: string): Promise<Contact | null> {
    const rows = await sql`
      SELECT ${CONTACT_COLUMNS}
      FROM contacts
      WHERE id = ${id} AND deleted_at IS NULL
      LIMIT 1
    `
    if (rows.length > 0) {
      return mapRowToContact(rows[0])
    }
    return null
  }

  async archiveContact(id: string): Promise<boolean> {
    const existing = await this.getContactById(id)
    if (!existing) return false

    const now = new Date().toISOString()
    await sql`UPDATE contacts SET deleted_at = ${now}, updated_at = ${now} WHERE id = ${id}`
    return true
  }

  async createContact(input: CreateContactInput): Promise<Contact> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const companyId = input.companyId || null
    const name = input.name || 'Unknown'
    const phoneNumber = input.phoneNumber || null
    const email = input.email || null
    const avatarUrl = input.avatarUrl || null
    const identifier = input.identifier || input.phoneNumber || id
    const contactType = input.contactType || 'lead'
    const customAttributes = input.customAttributes || {}
    const additionalAttributes = input.additionalAttributes || {}
    const blocked = input.blocked || false

    const rows = await sql`
      INSERT INTO contacts (
        id, company_id, name, phone_number, email, avatar_url, identifier,
        contact_type, custom_attributes, additional_attributes, blocked, created_at, updated_at
      ) VALUES (
        ${id}, ${companyId}, ${name}, ${phoneNumber},
        ${email}, ${avatarUrl}, ${identifier}, ${contactType},
        ${JSON.stringify(customAttributes)}, ${JSON.stringify(additionalAttributes)},
        ${blocked}, ${now}, ${now}
      )
      RETURNING ${CONTACT_COLUMNS}
    `
    return mapRowToContact(rows[0])
  }

  async updateContact(id: string, updates: UpdateContactInput): Promise<Contact | null> {
    const existing = await this.getContactById(id)
    if (!existing) {
      return null
    }

    const name = updates.name !== undefined ? updates.name : existing.name
    const phoneNumber =
      updates.phoneNumber !== undefined ? updates.phoneNumber : existing.phoneNumber
    const email = updates.email !== undefined ? updates.email : existing.email
    const avatarUrl = updates.avatarUrl !== undefined ? updates.avatarUrl : existing.avatarUrl
    const contactType =
      updates.contactType !== undefined ? updates.contactType : existing.contactType
    const blocked = updates.blocked !== undefined ? updates.blocked : existing.blocked

    const customAttributes =
      updates.customAttributes !== undefined
        ? { ...(existing.customAttributes || {}), ...updates.customAttributes }
        : existing.customAttributes || {}

    const additionalAttributes =
      updates.additionalAttributes !== undefined
        ? { ...(existing.additionalAttributes || {}), ...updates.additionalAttributes }
        : existing.additionalAttributes || {}

    const rows = await sql`
      UPDATE contacts
      SET
        name = ${name},
        phone_number = ${phoneNumber},
        email = ${email},
        avatar_url = ${avatarUrl},
        contact_type = ${contactType},
        blocked = ${blocked},
        custom_attributes = ${JSON.stringify(customAttributes)},
        additional_attributes = ${JSON.stringify(additionalAttributes)},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING ${CONTACT_COLUMNS}
    `
    if (rows.length > 0) {
      return mapRowToContact(rows[0])
    }

    return null
  }
}

export const contactService = new ContactService()
export default contactService
