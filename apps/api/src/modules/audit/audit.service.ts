import { parseJsonField, sql, toIsoString } from '../../db'

export interface AuditLogRecord {
  id: string
  userId: string | null
  action: string
  auditableType: string
  auditableId: string | null
  changes: Record<string, unknown>
  ipAddress: string | null
  createdAt: string
}

export interface CreateAuditLogInput {
  userId?: string | null
  action: string
  auditableType: string
  auditableId?: string | null
  changes?: Record<string, unknown>
  ipAddress?: string | null
}

export interface AuditLogFilter {
  action?: string
  auditableType?: string
  auditableId?: string
  userId?: string
  limit?: number
}

export class AuditService {
  async recordAuditLog(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    const id = crypto.randomUUID()
    const userId = input.userId ?? null
    const auditableId = input.auditableId ?? null
    const changes = JSON.stringify(input.changes || {})
    const ipAddress = input.ipAddress ?? null
    const now = new Date().toISOString()

    const rows = await sql`
      INSERT INTO audit_logs (
        id, user_id, action, auditable_type, auditable_id, changes, ip_address, created_at
      ) VALUES (
        ${id}, ${userId}, ${input.action}, ${input.auditableType}, ${auditableId}, ${changes}, ${ipAddress}, ${now}
      )
      RETURNING id, user_id as "userId", action, auditable_type as "auditableType",
                auditable_id as "auditableId", changes, ip_address as "ipAddress",
                created_at as "createdAt"
    `

    const row = rows[0] as Record<string, unknown>
    return {
      id: String(row.id),
      userId: (row.userId as string) ?? null,
      action: String(row.action),
      auditableType: String(row.auditableType),
      auditableId: (row.auditableId as string) ?? null,
      changes: parseJsonField(row.changes, {}),
      ipAddress: (row.ipAddress as string) ?? null,
      createdAt: toIsoString(row.createdAt) || now,
    }
  }

  async listAuditLogs(filter?: AuditLogFilter): Promise<AuditLogRecord[]> {
    const limit = filter?.limit ?? 100

    let rows: unknown[] = []
    if (filter?.action && filter?.auditableId) {
      rows = await sql`
        SELECT id, user_id as "userId", action, auditable_type as "auditableType",
               auditable_id as "auditableId", changes, ip_address as "ipAddress",
               created_at as "createdAt"
        FROM audit_logs
        WHERE action = ${filter.action} AND auditable_id = ${filter.auditableId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else if (filter?.action) {
      rows = await sql`
        SELECT id, user_id as "userId", action, auditable_type as "auditableType",
               auditable_id as "auditableId", changes, ip_address as "ipAddress",
               created_at as "createdAt"
        FROM audit_logs
        WHERE action = ${filter.action}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else if (filter?.auditableId) {
      rows = await sql`
        SELECT id, user_id as "userId", action, auditable_type as "auditableType",
               auditable_id as "auditableId", changes, ip_address as "ipAddress",
               created_at as "createdAt"
        FROM audit_logs
        WHERE auditable_id = ${filter.auditableId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else if (filter?.auditableType) {
      rows = await sql`
        SELECT id, user_id as "userId", action, auditable_type as "auditableType",
               auditable_id as "auditableId", changes, ip_address as "ipAddress",
               created_at as "createdAt"
        FROM audit_logs
        WHERE auditable_type = ${filter.auditableType}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else {
      rows = await sql`
        SELECT id, user_id as "userId", action, auditable_type as "auditableType",
               auditable_id as "auditableId", changes, ip_address as "ipAddress",
               created_at as "createdAt"
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      userId: (row.userId as string) ?? null,
      action: String(row.action),
      auditableType: String(row.auditableType),
      auditableId: (row.auditableId as string) ?? null,
      changes: parseJsonField(row.changes, {}),
      ipAddress: (row.ipAddress as string) ?? null,
      createdAt: toIsoString(row.createdAt) || new Date().toISOString(),
    }))
  }

  async auditUserRoleChange(
    actorId: string | null,
    targetUserId: string,
    oldRole: string,
    newRole: string,
    ipAddress?: string | null,
  ): Promise<AuditLogRecord> {
    return this.recordAuditLog({
      userId: actorId,
      action: 'user.role_change',
      auditableType: 'users',
      auditableId: targetUserId,
      changes: { old_role: oldRole, new_role: newRole },
      ipAddress,
    })
  }

  async auditWebhookDelete(
    actorId: string | null,
    webhookId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string | null,
  ): Promise<AuditLogRecord> {
    return this.recordAuditLog({
      userId: actorId,
      action: 'webhook.delete',
      auditableType: 'outgoing_webhooks',
      auditableId: webhookId,
      changes: metadata || {},
      ipAddress,
    })
  }

  async auditTicketBulkAssign(
    actorId: string | null,
    ticketIds: string[],
    assigneeId: string,
    ipAddress?: string | null,
  ): Promise<AuditLogRecord> {
    return this.recordAuditLog({
      userId: actorId,
      action: 'ticket.bulk_assign',
      auditableType: 'tickets',
      auditableId: null,
      changes: { ticket_ids: ticketIds, assignee_id: assigneeId },
      ipAddress,
    })
  }
}

export const auditService = new AuditService()

export const recordAuditLog = auditService.recordAuditLog.bind(auditService)
export const listAuditLogs = auditService.listAuditLogs.bind(auditService)
export const auditUserRoleChange = auditService.auditUserRoleChange.bind(auditService)
export const auditWebhookDelete = auditService.auditWebhookDelete.bind(auditService)
export const auditTicketBulkAssign = auditService.auditTicketBulkAssign.bind(auditService)
