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

const memoryStore = {
  slashCommands: new Map<string, SlashCommand>(),
}

export function resetSlashCommandStore(): void {
  memoryStore.slashCommands.clear()
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

    const record: SlashCommand = {
      id,
      name,
      description: dto.description ?? null,
      endpointUrl: dto.endpointUrl,
      authHeader: dto.authHeader ?? null,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await sql`
        INSERT INTO slash_commands (
          id, name, description, endpoint_url, auth_header, created_at, updated_at
        ) VALUES (
          ${id}, ${name}, ${record.description}, ${record.endpointUrl}, ${record.authHeader}, ${now}, ${now}
        )
      `
    } catch {
      // DB offline fallback
    }

    memoryStore.slashCommands.set(id, record)
    return record
  }

  async listSlashCommands(search?: string): Promise<SlashCommand[]> {
    const cleanSearch = search ? normalizeCommandName(search) : undefined

    try {
      if (cleanSearch) {
        const pattern = `${cleanSearch}%`
        const rows = await sql`
          SELECT id, name, description, endpoint_url AS "endpointUrl",
                 auth_header AS "authHeader", created_at AS "createdAt", updated_at AS "updatedAt"
          FROM slash_commands
          WHERE name ILIKE ${pattern}
          ORDER BY name ASC
        `
        if (rows && rows.length >= 0) {
          return rows as unknown as SlashCommand[]
        }
      } else {
        const rows = await sql`
          SELECT id, name, description, endpoint_url AS "endpointUrl",
                 auth_header AS "authHeader", created_at AS "createdAt", updated_at AS "updatedAt"
          FROM slash_commands
          ORDER BY name ASC
        `
        if (rows && rows.length > 0) {
          return rows as unknown as SlashCommand[]
        }
      }
    } catch {
      // DB offline fallback
    }

    const list = Array.from(memoryStore.slashCommands.values())
    if (cleanSearch) {
      const lower = cleanSearch.toLowerCase()
      return list
        .filter((item) => item.name.toLowerCase().startsWith(lower))
        .sort((a, b) => a.name.localeCompare(b.name))
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }

  async getSlashCommandById(id: string): Promise<SlashCommand | null> {
    try {
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
    } catch {
      // DB offline fallback
    }

    return memoryStore.slashCommands.get(id) || null
  }

  async getSlashCommandByName(name: string): Promise<SlashCommand | null> {
    const cleanName = normalizeCommandName(name)
    try {
      const rows = await sql`
        SELECT id, name, description, endpoint_url AS "endpointUrl",
               auth_header AS "authHeader", created_at AS "createdAt", updated_at AS "updatedAt"
        FROM slash_commands
        WHERE name = ${cleanName}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as SlashCommand
      }
    } catch {
      // DB offline fallback
    }

    for (const cmd of memoryStore.slashCommands.values()) {
      if (cmd.name.toLowerCase() === cleanName.toLowerCase()) {
        return cmd
      }
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
    const updated: SlashCommand = {
      ...existing,
      name: newName,
      description: dto.description !== undefined ? dto.description : existing.description,
      endpointUrl: dto.endpointUrl ?? existing.endpointUrl,
      authHeader: dto.authHeader !== undefined ? dto.authHeader : existing.authHeader,
      updatedAt: now,
    }

    try {
      await sql`
        UPDATE slash_commands
        SET name = ${updated.name},
            description = ${updated.description},
            endpoint_url = ${updated.endpointUrl},
            auth_header = ${updated.authHeader},
            updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // DB offline fallback
    }

    memoryStore.slashCommands.set(id, updated)
    return updated
  }

  async deleteSlashCommand(id: string): Promise<boolean> {
    const existing = await this.getSlashCommandById(id)
    if (!existing) {
      return false
    }

    try {
      await sql`DELETE FROM slash_commands WHERE id = ${id}`
    } catch {
      // DB offline fallback
    }

    memoryStore.slashCommands.delete(id)
    return true
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
