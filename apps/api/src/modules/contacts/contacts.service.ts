import type { Contact, CreateContactInput, UpdateContactInput } from '@xatxoot/shared'
import { sql } from '../../db'

const memoryStore = {
  contacts: new Map<string, Contact>(),
}

export function resetContactStore(): void {
  memoryStore.contacts.clear()
}

export class ContactService {
  async listContacts(): Promise<Contact[]> {
    try {
      const rows = await sql`
        SELECT id, company_id as "companyId", name, phone_number as "phoneNumber",
               email, avatar_url as "avatarUrl", identifier, contact_type as "contactType",
               custom_attributes as "customAttributes", additional_attributes as "additionalAttributes",
               blocked, created_at as "createdAt", updated_at as "updatedAt"
        FROM contacts
        ORDER BY updated_at DESC
      `
      if (rows.length > 0) {
        for (const r of rows) {
          memoryStore.contacts.set(r.id, r as Contact)
        }
        return rows as Contact[]
      }
    } catch {
      // Memory fallback
    }
    return Array.from(memoryStore.contacts.values())
  }

  async getContactById(id: string): Promise<Contact | null> {
    try {
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
        const contact = rows[0] as Contact
        memoryStore.contacts.set(contact.id, contact)
        return contact
      }
    } catch {
      // ignore error
    }
    return memoryStore.contacts.get(id) || null
  }

  async createContact(input: CreateContactInput): Promise<Contact> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const contact: Contact = {
      id,
      companyId: input.companyId || null,
      name: input.name || 'Unknown',
      phoneNumber: input.phoneNumber || null,
      email: input.email || null,
      avatarUrl: input.avatarUrl || null,
      identifier: input.identifier || input.phoneNumber || id,
      contactType: input.contactType || 'lead',
      customAttributes: input.customAttributes || {},
      additionalAttributes: input.additionalAttributes || {},
      blocked: input.blocked || false,
      createdAt: now,
      updatedAt: now,
    }
    memoryStore.contacts.set(id, contact)

    try {
      const rows = await sql`
        INSERT INTO contacts (
          id, company_id, name, phone_number, email, avatar_url, identifier,
          contact_type, custom_attributes, additional_attributes, blocked, created_at, updated_at
        ) VALUES (
          ${contact.id}, ${contact.companyId}, ${contact.name}, ${contact.phoneNumber},
          ${contact.email}, ${contact.avatarUrl}, ${contact.identifier}, ${contact.contactType},
          ${JSON.stringify(contact.customAttributes)}, ${JSON.stringify(contact.additionalAttributes)},
          ${contact.blocked}, ${contact.createdAt}, ${contact.updatedAt}
        )
        RETURNING id, company_id as "companyId", name, phone_number as "phoneNumber",
                  email, avatar_url as "avatarUrl", identifier, contact_type as "contactType",
                  custom_attributes as "customAttributes", additional_attributes as "additionalAttributes",
                  blocked, created_at as "createdAt", updated_at as "updatedAt"
      `
      if (rows.length > 0) {
        const saved = rows[0] as Contact
        memoryStore.contacts.set(saved.id, saved)
        return saved
      }
    } catch {
      // Memory fallback
    }

    return contact
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

    const updatedContact: Contact = {
      ...existing,
      name,
      phoneNumber,
      email,
      avatarUrl,
      contactType,
      blocked,
      customAttributes,
      additionalAttributes,
      updatedAt: new Date().toISOString(),
    }
    memoryStore.contacts.set(id, updatedContact)

    try {
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
        const saved = rows[0] as Contact
        memoryStore.contacts.set(id, saved)
        return saved
      }
    } catch (err) {
      console.error('Failed to update contact in DB:', err)
    }

    return updatedContact
  }
}

export const contactService = new ContactService()
export default contactService
