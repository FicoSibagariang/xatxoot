import type {
  CreateSlashCommandInput,
  ExecuteSlashCommandInput,
  SlashCommand,
  SlashCommandExecutionResponse,
  UpdateSlashCommandInput,
} from '@xatxoot/shared'
import { sql } from '../../db'

export type {
  SlashCommand,
  CreateSlashCommandInput,
  UpdateSlashCommandInput,
  ExecuteSlashCommandInput,
  SlashCommandExecutionResponse,
}

export class SlashCommandTimeoutError extends Error {
  constructor(message = 'Timeout: Webhook eksternal tidak merespons dalam 3 detik') {
    super(message)
    this.name = 'SlashCommandTimeoutError'
  }
}

export function sanitizeResponseContent(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''

  let sanitized = raw
    // Remove script tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and contents
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove iframe tags and contents
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove inline event handlers (onerror=, onload=, onclick=, etc.)
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^>\s]+/gi, '')
    // Remove javascript: pseudo-protocols
    .replace(/javascript:[^"'\s]*/gi, '')

  // Prevent excess payload size
  if (sanitized.length > 10000) {
    sanitized = sanitized.slice(0, 10000)
  }

  return sanitized.trim()
}

function normalizeCommandName(name: string): string {
  let cleaned = name.trim()
  if (cleaned.startsWith('/')) {
    cleaned = cleaned.slice(1).trim()
  }
  return cleaned
}

export async function resetSlashCommandStore(): Promise<void> {
  await sql`DELETE FROM slash_commands`
}

export class SlashCommandService {
  async createSlashCommand(dto: CreateSlashCommandInput): Promise<SlashCommand> {
    const name = normalizeCommandName(dto.name)
    if (!name) {
      throw new Error('Nama slash command wajib diisi')
    }

    const existing = await this.getSlashCommandByName(name)
    if (existing) {
      throw new Error(`Slash command '${name}' sudah digunakan`)
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await sql`
      INSERT INTO slash_commands (
        id, name, description, endpoint_url, auth_header, created_at, updated_at
      ) VALUES (
        ${id}, ${name}, ${dto.description ?? null}, ${dto.endpointUrl}, ${dto.authHeader ?? null}, ${now}, ${now}
      )
      RETURNING id, name, description, endpoint_url AS "endpointUrl",
                auth_header AS "authHeader", created_at AS "createdAt", updated_at AS "updatedAt"
    `
    return rows[0] as unknown as SlashCommand
  }

  async listSlashCommands(search?: string): Promise<SlashCommand[]> {
    const cleanSearch = search ? normalizeCommandName(search) : undefined

    if (cleanSearch) {
      const pattern = `${cleanSearch}%`
      const rows = await sql`
        SELECT id, name, description, endpoint_url AS "endpointUrl",
               auth_header AS "authHeader", created_at AS "createdAt", updated_at AS "updatedAt"
        FROM slash_commands
        WHERE name ILIKE ${pattern}
        ORDER BY name ASC
      `
      return rows as unknown as SlashCommand[]
    }

    const rows = await sql`
      SELECT id, name, description, endpoint_url AS "endpointUrl",
             auth_header AS "authHeader", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM slash_commands
      ORDER BY name ASC
    `
    return rows as unknown as SlashCommand[]
  }

  async getSlashCommandById(id: string): Promise<SlashCommand | null> {
    const rows = await sql`
      SELECT id, name, description, endpoint_url AS "endpointUrl",
             auth_header AS "authHeader", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM slash_commands
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return rows[0] as unknown as SlashCommand
    }

    return null
  }

  async getSlashCommandByName(name: string): Promise<SlashCommand | null> {
    const cleanName = normalizeCommandName(name)
    const rows = await sql`
      SELECT id, name, description, endpoint_url AS "endpointUrl",
             auth_header AS "authHeader", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM slash_commands
      WHERE LOWER(name) = LOWER(${cleanName})
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return rows[0] as unknown as SlashCommand
    }

    return null
  }

  async updateSlashCommand(id: string, dto: UpdateSlashCommandInput): Promise<SlashCommand | null> {
    const existing = await this.getSlashCommandById(id)
    if (!existing) {
      return null
    }

    let newName = existing.name
    if (dto.name !== undefined) {
      newName = normalizeCommandName(dto.name)
      if (newName.toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = await this.getSlashCommandByName(newName)
        if (duplicate && duplicate.id !== id) {
          throw new Error(`Slash command '${newName}' sudah digunakan`)
        }
      }
    }

    const now = new Date().toISOString()
    const description = dto.description !== undefined ? dto.description : existing.description
    const endpointUrl = dto.endpointUrl ?? existing.endpointUrl
    const authHeader = dto.authHeader !== undefined ? dto.authHeader : existing.authHeader

    const rows = await sql`
      UPDATE slash_commands
      SET name = ${newName},
          description = ${description},
          endpoint_url = ${endpointUrl},
          auth_header = ${authHeader},
          updated_at = ${now}
      WHERE id = ${id}
      RETURNING id, name, description, endpoint_url AS "endpointUrl",
                auth_header AS "authHeader", created_at AS "createdAt", updated_at AS "updatedAt"
    `
    if (rows && rows.length > 0) {
      return rows[0] as unknown as SlashCommand
    }

    return null
  }

  async deleteSlashCommand(id: string): Promise<boolean> {
    const rows = await sql`DELETE FROM slash_commands WHERE id = ${id} RETURNING id`
    return rows.length > 0
  }

  async executeSlashCommand(dto: ExecuteSlashCommandInput): Promise<SlashCommandExecutionResponse> {
    const commandName = normalizeCommandName(dto.command)
    const command = await this.getSlashCommandByName(commandName)

    if (!command) {
      throw new Error(`Slash command '${commandName}' tidak ditemukan`)
    }

    const payload = {
      command: command.name,
      params: dto.params ?? '',
      conversationId: dto.conversationId,
      ticketId: dto.ticketId ?? null,
      timestamp: new Date().toISOString(),
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Xatxoot-SlashCommand/1.0',
    }

    if (command.authHeader) {
      headers.Authorization = command.authHeader
    }

    let response: Response
    try {
      response = await fetch(command.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000), // Strict 3 seconds timeout
      })
    } catch (err: unknown) {
      const error = err as Error
      if (
        error.name === 'TimeoutError' ||
        error.message?.toLowerCase().includes('timeout') ||
        error.message?.toLowerCase().includes('aborted')
      ) {
        throw new SlashCommandTimeoutError(
          'Timeout: Webhook eksternal tidak merespons dalam 3 detik',
        )
      }
      throw new Error(`Gagal memanggil webhook eksternal: ${error.message}`)
    }

    if (!response.ok) {
      throw new Error(`Webhook eksternal mengembalikan status HTTP ${response.status}`)
    }

    let rawContent = ''
    let metadata: Record<string, unknown> = {}

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        const json = (await response.json()) as Record<string, unknown>
        if (typeof json === 'object' && json !== null) {
          const possibleText = json.content ?? json.text ?? json.message
          rawContent = typeof possibleText === 'string' ? possibleText : JSON.stringify(json)
          if (json.metadata && typeof json.metadata === 'object') {
            metadata = json.metadata as Record<string, unknown>
          }
        } else {
          rawContent = String(json)
        }
      } catch {
        rawContent = await response.text()
      }
    } else {
      rawContent = await response.text()
    }

    const sanitizedContent = sanitizeResponseContent(rawContent)

    return {
      content: sanitizedContent,
      format: 'text',
      metadata,
    }
  }
}

export const slashCommandService = new SlashCommandService()
