import type {
  CannedResponse,
  CreateCannedResponseInput,
  UpdateCannedResponseInput,
} from '@xatxoot/shared'
import { sql } from '../../db'

export type { CannedResponse, CreateCannedResponseInput, UpdateCannedResponseInput }

export async function resetCannedResponseStore(): Promise<void> {
  await sql`DELETE FROM canned_responses`
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

    const rows = await sql`
      INSERT INTO canned_responses (
        id, short_code, content, created_at, updated_at
      ) VALUES (
        ${id}, ${shortCode}, ${dto.content}, ${now}, ${now}
      )
      RETURNING id, short_code AS "shortCode", content, created_at AS "createdAt", updated_at AS "updatedAt"
    `

    return rows[0] as unknown as CannedResponse
  }

  async getByShortCode(shortCode: string): Promise<CannedResponse | null> {
    const cleaned = normalizeShortCode(shortCode)
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

    return null
  }

  async listCannedResponses(prefix?: string): Promise<CannedResponse[]> {
    const cleanPrefix = prefix ? normalizeShortCode(prefix) : undefined

    if (cleanPrefix) {
      const pattern = `${cleanPrefix}%`
      const rows = await sql`
        SELECT id, short_code AS "shortCode", content,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM canned_responses
        WHERE short_code ILIKE ${pattern}
        ORDER BY short_code ASC
      `
      return (rows || []) as unknown as CannedResponse[]
    }

    const rows = await sql`
      SELECT id, short_code AS "shortCode", content,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM canned_responses
      ORDER BY short_code ASC
    `
    return (rows || []) as unknown as CannedResponse[]
  }

  async getCannedResponseById(id: string): Promise<CannedResponse | null> {
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

    return null
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
    const content = dto.content !== undefined ? dto.content : existing.content

    const rows = await sql`
      UPDATE canned_responses
      SET short_code = ${newShortCode},
          content = ${content},
          updated_at = ${now}
      WHERE id = ${id}
      RETURNING id, short_code AS "shortCode", content, created_at AS "createdAt", updated_at AS "updatedAt"
    `

    if (rows && rows.length > 0) {
      return rows[0] as unknown as CannedResponse
    }

    return null
  }

  async deleteCannedResponse(id: string): Promise<boolean> {
    const rows = await sql`DELETE FROM canned_responses WHERE id = ${id} RETURNING id`
    return rows.length > 0
  }
}

export const cannedResponseService = new CannedResponseService()
