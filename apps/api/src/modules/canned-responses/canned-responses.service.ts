import type {
  CannedResponse,
  CreateCannedResponseInput,
  UpdateCannedResponseInput,
} from '@xatxoot/shared'
import { sql } from '../../db'

export type { CannedResponse, CreateCannedResponseInput, UpdateCannedResponseInput }

const memoryStore = {
  cannedResponses: new Map<string, CannedResponse>(),
}

export function resetCannedResponseStore(): void {
  memoryStore.cannedResponses.clear()
}

function normalizeShortCode(shortCode: string): string {
  let cleaned = shortCode.trim()
  if (cleaned.startsWith('/')) {
    cleaned = cleaned.slice(1).trim()
  }
  return cleaned
}

export class CannedResponseService {
  async createCannedResponse(dto: CreateCannedResponseInput): Promise<CannedResponse> {
    const shortCode = normalizeShortCode(dto.shortCode)
    if (!shortCode) {
      throw new Error('Short code tidak valid')
    }

    // Check uniqueness
    const existing = await this.getByShortCode(shortCode)
    if (existing) {
      throw new Error(`Short code '${shortCode}' sudah digunakan`)
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const record: CannedResponse = {
      id,
      shortCode,
      content: dto.content,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await sql`
        INSERT INTO canned_responses (
          id, short_code, content, created_at, updated_at
        ) VALUES (
          ${id}, ${shortCode}, ${record.content}, ${now}, ${now}
        )
      `
    } catch {
      // DB offline fallback
    }

    memoryStore.cannedResponses.set(id, record)
    return record
  }

  async getByShortCode(shortCode: string): Promise<CannedResponse | null> {
    const cleaned = normalizeShortCode(shortCode)
    try {
      const rows = await sql`
        SELECT id, short_code AS "shortCode", content,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM canned_responses
        WHERE short_code = ${cleaned}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as CannedResponse
      }
    } catch {
      // DB offline fallback
    }

    for (const item of memoryStore.cannedResponses.values()) {
      if (item.shortCode.toLowerCase() === cleaned.toLowerCase()) {
        return item
      }
    }
    return null
  }

  async listCannedResponses(prefix?: string): Promise<CannedResponse[]> {
    const cleanPrefix = prefix ? normalizeShortCode(prefix) : undefined

    try {
      if (cleanPrefix) {
        const pattern = `${cleanPrefix}%`
        const rows = await sql`
          SELECT id, short_code AS "shortCode", content,
                 created_at AS "createdAt", updated_at AS "updatedAt"
          FROM canned_responses
          WHERE short_code ILIKE ${pattern}
          ORDER BY short_code ASC
        `
        if (rows && rows.length >= 0) {
          return rows as unknown as CannedResponse[]
        }
      } else {
        const rows = await sql`
          SELECT id, short_code AS "shortCode", content,
                 created_at AS "createdAt", updated_at AS "updatedAt"
          FROM canned_responses
          ORDER BY short_code ASC
        `
        if (rows && rows.length > 0) {
          return rows as unknown as CannedResponse[]
        }
      }
    } catch {
      // DB offline fallback
    }

    const list = Array.from(memoryStore.cannedResponses.values())
    if (cleanPrefix) {
      const lower = cleanPrefix.toLowerCase()
      return list
        .filter((item) => item.shortCode.toLowerCase().startsWith(lower))
        .sort((a, b) => a.shortCode.localeCompare(b.shortCode))
    }
    return list.sort((a, b) => a.shortCode.localeCompare(b.shortCode))
  }

  async getCannedResponseById(id: string): Promise<CannedResponse | null> {
    try {
      const rows = await sql`
        SELECT id, short_code AS "shortCode", content,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM canned_responses
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as CannedResponse
      }
    } catch {
      // DB offline fallback
    }

    return memoryStore.cannedResponses.get(id) || null
  }

  async updateCannedResponse(
    id: string,
    dto: UpdateCannedResponseInput,
  ): Promise<CannedResponse | null> {
    const existing = await this.getCannedResponseById(id)
    if (!existing) {
      return null
    }

    let newShortCode = existing.shortCode
    if (dto.shortCode !== undefined) {
      newShortCode = normalizeShortCode(dto.shortCode)
      if (newShortCode.toLowerCase() !== existing.shortCode.toLowerCase()) {
        const duplicate = await this.getByShortCode(newShortCode)
        if (duplicate && duplicate.id !== id) {
          throw new Error(`Short code '${newShortCode}' sudah digunakan`)
        }
      }
    }

    const now = new Date().toISOString()
    const updated: CannedResponse = {
      ...existing,
      shortCode: newShortCode,
      content: dto.content !== undefined ? dto.content : existing.content,
      updatedAt: now,
    }

    try {
      await sql`
        UPDATE canned_responses
        SET short_code = ${updated.shortCode},
            content = ${updated.content},
            updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // DB offline fallback
    }

    memoryStore.cannedResponses.set(id, updated)
    return updated
  }

  async deleteCannedResponse(id: string): Promise<boolean> {
    const existing = await this.getCannedResponseById(id)
    if (!existing) {
      return false
    }

    try {
      await sql`DELETE FROM canned_responses WHERE id = ${id}`
    } catch {
      // DB offline fallback
    }

    memoryStore.cannedResponses.delete(id)
    return true
  }
}

export const cannedResponseService = new CannedResponseService()
