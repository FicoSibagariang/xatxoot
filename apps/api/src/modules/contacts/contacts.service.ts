import type { Contact, CreateContactInput, UpdateContactInput } from '@xatxoot/shared'
import { sql } from '../../db'

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value as T
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

function mapContactRow(row: Record<string, unknown>): Contact {
  return {
    ...(row as unknown as Contact),
    customAttributes: parseJsonField(row.customAttributes, {}),
    additionalAttributes: parseJsonField(row.additionalAttributes, {}),
  }
}

export async function resetContactStore(): Promise<void> {
  await sql`DELETE FROM contacts`
}

export class ContactService {
  async listContacts(): Promise<Contact[]> {
    const rows = await sql`
      SELECT id, company_id as "companyId", name, phone_number as "phoneNumber",
             email, avatar_url as "avatarUrl", identifier, contact_type as "contactType",
             custom_attributes as "customAttributes", additional_attributes as "additionalAttributes",
             blocked, created_at as "createdAt", updated_at as "updatedAt"
      FROM contacts
      ORDER BY updated_at DESC
    `
    return rows.map(mapContactRow)
  }

  async getContactById(id: string): Promise<Contact | null> {
    const rows = await sql`
      SELECT id, company_id as "companyId", name, phone_number as "phoneNumber",
             email, avatar_url as "avatarUrl", identifier, contact_type as "contactType",
             custom_attributes as "customAttributes", additional_attributes as "additionalAttributes",
             blocked, created_at as "createdAt", updated_at as "updatedAt"
      FROM contacts
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows.length > 0) {
      return mapContactRow(rows[0])
    }
    return null
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
      RETURNING id, company_id as "companyId", name, phone_number as "phoneNumber",
                email, avatar_url as "avatarUrl", identifier, contact_type as "contactType",
                custom_attributes as "customAttributes", additional_attributes as "additionalAttributes",
                blocked, created_at as "createdAt", updated_at as "updatedAt"
    `
    return mapContactRow(rows[0])
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
      RETURNING id, company_id as "companyId", name, phone_number as "phoneNumber",
                email, avatar_url as "avatarUrl", identifier, contact_type as "contactType",
                custom_attributes as "customAttributes", additional_attributes as "additionalAttributes",
                blocked, created_at as "createdAt", updated_at as "updatedAt"
    `
    if (rows.length > 0) {
      return mapContactRow(rows[0])
    }

    return null
  }
}

export const contactService = new ContactService()
export default contactService
