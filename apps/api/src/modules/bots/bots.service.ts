import type {
  BotEdge,
  BotFlow,
  BotFlowDefinition,
  BotNode,
  BotSession,
  BranchConditionRule,
  BranchNode,
  CreateBotFlowInput,
  HandoffNode,
  HttpNode,
  MessageNode,
  QuestionNode,
  UpdateBotFlowInput,
} from '@xatxoot/shared'
import { BotFlowDefinitionSchema, CreateBotFlowInputSchema } from '@xatxoot/shared'
import { parseJsonField, sql, toIsoString, toValidUuid } from '../../db'
import { realtimeService } from '../realtime/realtime.service'
import { ticketService } from '../tickets/tickets.service'

export interface BotEmittedMessage {
  id: string
  text: string
  mediaUrl?: string | null
  mediaType?: string | null
}

export interface BotStepExecutionResult {
  session: BotSession
  messages: BotEmittedMessage[]
}

function mapFlowRow(row: Record<string, unknown>): BotFlow {
  return {
    id: String(row.id),
    name: String(row.name),
    triggerType: row.triggerType as BotFlow['triggerType'],
    active: Boolean(row.active),
    flowDefinition: parseJsonField<BotFlowDefinition>(row.flowDefinition, {
      startNodeId: '',
      nodes: [],
      edges: [],
      variables: {},
    }),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

function mapSessionRow(row: Record<string, unknown>): BotSession {
  return {
    id: String(row.id),
    conversationId: String(row.conversationId),
    flowId: String(row.flowId),
    currentNodeId: (row.currentNodeId as string | null) ?? null,
    status: row.status as BotSession['status'],
    contextData: parseJsonField<Record<string, unknown>>(row.contextData, {}),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

async function ensureConversationExists(conversationId: string): Promise<void> {
  const vConvId = toValidUuid(conversationId)
  const defaultInboxId = '00000000-0000-0000-0000-000000000001'
  await sql`
    INSERT INTO inboxes (id, name, channel_type, channel_id)
    VALUES (${defaultInboxId}, 'Default Inbox', 'api', ${crypto.randomUUID()})
    ON CONFLICT (id) DO NOTHING
  `
  await sql`
    INSERT INTO conversations (id, inbox_id)
    VALUES (${vConvId}, ${defaultInboxId})
    ON CONFLICT (id) DO NOTHING
  `
}

export async function resetBotStore(): Promise<void> {
  await sql`DELETE FROM bot_sessions`
  await sql`DELETE FROM bot_flows`
  botEngineService.resetOutputs()
}

/**
 * Interpolate {{variable}} or {{variable.prop}} from contextData
 */
export function interpolateVariables(template: string, context: Record<string, unknown>): string {
  if (!template) return ''
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
    const parts = path.split('.')
    let current: unknown = context
    for (const part of parts) {
      if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part]
      } else {
        return ''
      }
    }
    return current !== undefined && current !== null ? String(current) : ''
  })
}

export class BotEngineService {
  private lastOutputs = new Map<string, BotEmittedMessage[]>()

  resetOutputs(): void {
    this.lastOutputs.clear()
  }

  /**
   * Create a new Bot Flow
   */
  async createFlow(input: CreateBotFlowInput): Promise<BotFlow> {
    const parsed = CreateBotFlowInputSchema.parse(input)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const active = parsed.active ?? true
    const triggerType = parsed.triggerType || 'conversation_opened'

    const rows = await sql`
      INSERT INTO bot_flows (
        id, name, trigger_type, active, flow_definition, created_at, updated_at
      ) VALUES (
        ${id}, ${parsed.name}, ${triggerType}, ${active},
        ${JSON.stringify(parsed.flowDefinition)}, ${now}, ${now}
      )
      RETURNING
        id, name, trigger_type AS "triggerType", active,
        flow_definition AS "flowDefinition", created_at AS "createdAt", updated_at AS "updatedAt"
    `

    return mapFlowRow(rows[0])
  }

  /**
   * List bot flows
   */
  async listFlows(filter?: { active?: boolean; triggerType?: string }): Promise<BotFlow[]> {
    let query = sql`
      SELECT id, name, trigger_type AS "triggerType", active,
             flow_definition AS "flowDefinition", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM bot_flows
      WHERE 1 = 1
    `

    if (filter?.active !== undefined) {
      query = sql`${query} AND active = ${filter.active}`
    }
    if (filter?.triggerType) {
      query = sql`${query} AND trigger_type = ${filter.triggerType}`
    }

    query = sql`${query} ORDER BY created_at DESC`
    const rows = await query
    return (rows || []).map(mapFlowRow)
  }

  /**
   * Get bot flow by ID
   */
  async getFlowById(id: string): Promise<BotFlow | null> {
    const rows = await sql`
      SELECT id, name, trigger_type AS "triggerType", active,
             flow_definition AS "flowDefinition", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM bot_flows
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapFlowRow(rows[0])
    }

    return null
  }

  /**
   * Update bot flow
   */
  async updateFlow(id: string, input: UpdateBotFlowInput): Promise<BotFlow> {
    const existing = await this.getFlowById(id)
    if (!existing) {
      throw new Error(`Bot flow not found: ${id}`)
    }

    const now = new Date().toISOString()
    const name = input.name ?? existing.name
    const triggerType = input.triggerType ?? existing.triggerType
    const active = input.active !== undefined ? input.active : existing.active
    const flowDefinition = input.flowDefinition ?? existing.flowDefinition

    const rows = await sql`
      UPDATE bot_flows
      SET name = ${name},
          trigger_type = ${triggerType},
          active = ${active},
          flow_definition = ${JSON.stringify(flowDefinition)},
          updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id, name, trigger_type AS "triggerType", active,
        flow_definition AS "flowDefinition", created_at AS "createdAt", updated_at AS "updatedAt"
    `

    return mapFlowRow(rows[0])
  }

  /**
   * Delete bot flow
   */
  async deleteFlow(id: string): Promise<boolean> {
    const rows = await sql`DELETE FROM bot_flows WHERE id = ${id} RETURNING id`
    return rows.length > 0
  }

  /**
   * Start a new bot session for a conversation
   */
  async startSession(
    conversationId: string,
    flowId: string,
    options?: { ticketId?: string; initialContext?: Record<string, unknown> },
  ): Promise<BotSession> {
    const flow = await this.getFlowById(flowId)
    if (!flow) {
      throw new Error(`Bot flow not found: ${flowId}`)
    }

    const validConvId = toValidUuid(conversationId)
    await ensureConversationExists(validConvId)

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const contextData: Record<string, unknown> = {
      ...(flow.flowDefinition.variables || {}),
      ...(options?.initialContext || {}),
    }

    if (options?.ticketId) {
      contextData._ticketId = options.ticketId
    }

    const startNodeId = flow.flowDefinition.startNodeId

    const rows = await sql`
      INSERT INTO bot_sessions (
        id, conversation_id, flow_id, current_node_id, status, context_data, created_at, updated_at
      ) VALUES (
        ${id}, ${validConvId}, ${flow.id},
        ${startNodeId}, 'active', ${JSON.stringify(contextData)},
        ${now}, ${now}
      )
      RETURNING
        id, conversation_id AS "conversationId", flow_id AS "flowId",
        current_node_id AS "currentNodeId", status, context_data AS "contextData",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `

    let session = mapSessionRow(rows[0])

    // Immediately execute graph starting from startNodeId until it needs input or reaches terminal
    const execResult = await this.executeGraphStep(session, flow, null)
    session = execResult.session
    this.lastOutputs.set(id, execResult.messages)

    return session
  }

  /**
   * Get bot session by ID
   */
  async getSessionById(id: string): Promise<BotSession | null> {
    const rows = await sql`
      SELECT id, conversation_id AS "conversationId", flow_id AS "flowId",
             current_node_id AS "currentNodeId", status, context_data AS "contextData",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM bot_sessions
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapSessionRow(rows[0])
    }

    return null
  }

  /**
   * Get last emitted messages for a session
   */
  async getLastExecutionOutput(sessionId: string): Promise<{
    session: BotSession
    messages: BotEmittedMessage[]
  }> {
    const session = await this.getSessionById(sessionId)
    if (!session) throw new Error(`Bot session not found: ${sessionId}`)
    const messages = this.lastOutputs.get(sessionId) || []
    return { session, messages }
  }

  /**
   * Process contact input into an active bot session
   */
  async processUserInput(sessionId: string, userInput: string): Promise<BotStepExecutionResult> {
    let session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error(`Bot session not found: ${sessionId}`)
    }

    if (session.status !== 'active') {
      return { session, messages: [] }
    }

    const flow = await this.getFlowById(session.flowId)
    if (!flow) {
      throw new Error(`Bot flow not found: ${session.flowId}`)
    }

    // Execute step with user input
    const execResult = await this.executeGraphStep(session, flow, userInput)
    session = execResult.session

    this.lastOutputs.set(sessionId, execResult.messages)
    return execResult
  }

  /**
   * Core state machine graph execution
   */
  private async executeGraphStep(
    session: BotSession,
    flow: BotFlow,
    userInput: string | null,
  ): Promise<BotStepExecutionResult> {
    const messages: BotEmittedMessage[] = []
    const nodeMap = new Map<string, BotNode>()
    for (const n of flow.flowDefinition.nodes) {
      nodeMap.set(n.id, n)
    }

    let currentNodeId: string | null = session.currentNodeId || flow.flowDefinition.startNodeId
    let isHandlingInput = userInput !== null

    // Safety guard against infinite loops
    let steps = 0
    const maxSteps = 50

    while (currentNodeId && steps < maxSteps) {
      steps++
      const node = nodeMap.get(currentNodeId)
      if (!node) {
        session.status = 'completed'
        currentNodeId = null
        break
      }

      // 1. Message Node
      if (node.type === 'message') {
        const msgNode = node as MessageNode
        const interpolatedText = interpolateVariables(msgNode.data.text, session.contextData)
        messages.push({
          id: crypto.randomUUID(),
          text: interpolatedText,
          mediaUrl: msgNode.data.mediaUrl,
          mediaType: msgNode.data.mediaType,
        })

        // Advance to next edge
        const edge = flow.flowDefinition.edges.find((e) => e.source === node.id)
        currentNodeId = edge?.target || null
        if (!currentNodeId) {
          session.status = 'completed'
          break
        }
        continue
      }

      // 2. Question Node
      if (node.type === 'question') {
        const qNode = node as {
          data: {
            question?: string
            questionText?: string
            options?: Array<{ id: string; label?: string; text?: string; value?: string }>
            choices?: Array<{ id: string; label?: string; text?: string; value?: string }>
            variableName?: string
          }
        }
        const promptText = qNode.data.question || qNode.data.questionText || ''

        if (!isHandlingInput) {
          // Send prompt question and pause execution awaiting user response
          const prompt = interpolateVariables(promptText, session.contextData)
          messages.push({
            id: crypto.randomUUID(),
            text: prompt,
          })
          break
        }

        // Handle user reply
        const rawInput = (userInput || '').trim()
        const choices = (qNode.data.options || qNode.data.choices || []) as Array<{
          id: string
          label?: string
          text?: string
          value?: string
        }>

        if (choices.length > 0) {
          const choice = choices.find(
            (c, idx) =>
              c.id.toLowerCase() === rawInput.toLowerCase() ||
              (c.value && c.value.toLowerCase() === rawInput.toLowerCase()) ||
              (c.text && c.text.toLowerCase() === rawInput.toLowerCase()) ||
              (c.label && c.label.toLowerCase() === rawInput.toLowerCase()) ||
              rawInput === String(idx + 1),
          )

          if (choice) {
            session.contextData[qNode.data.variableName] = choice.value || choice.id

            // Check if choice has custom target edge or proceed via standard edge
            const choiceEdge = flow.flowDefinition.edges.find(
              (e) =>
                e.source === node.id &&
                (e.sourceHandle === choice.id ||
                  e.label === choice.id ||
                  e.sourceHandle === choice.value),
            )
            const fallbackEdge = flow.flowDefinition.edges.find((e) => e.source === node.id)
            currentNodeId = choiceEdge?.target || fallbackEdge?.target || null
          } else {
            // Invalid choice reply: emit error and keep session paused on current node
            messages.push({
              id: crypto.randomUUID(),
              text: 'Pilihan tidak valid. Silakan pilih opsi yang tersedia.',
            })
            break
          }
        } else {
          // Freeform text question
          session.contextData[qNode.data.variableName] = rawInput
          const edge = flow.flowDefinition.edges.find((e) => e.source === node.id)
          currentNodeId = edge?.target || null
        }

        isHandlingInput = false
        if (!currentNodeId) {
          session.status = 'completed'
          break
        }
        continue
      }

      // 3. HTTP Request Node
      if (node.type === 'http') {
        const httpNode = node as HttpNode
        const url = interpolateVariables(httpNode.data.url, session.contextData)

        try {
          const fetchOptions: RequestInit = {
            method: httpNode.data.method,
            headers: {
              'Content-Type': 'application/json',
              ...(httpNode.data.headers || {}),
            },
            signal: AbortSignal.timeout(10000),
          }

          if (httpNode.data.body && ['POST', 'PUT', 'PATCH'].includes(httpNode.data.method)) {
            const bodyStr =
              typeof httpNode.data.body === 'string'
                ? interpolateVariables(httpNode.data.body, session.contextData)
                : JSON.stringify(httpNode.data.body)
            fetchOptions.body = bodyStr
          }

          const response = await fetch(url, fetchOptions)
          const responseBody = await response.json().catch(() => ({}))

          session.contextData[httpNode.data.responseVariable || 'http_response'] = responseBody
        } catch (err) {
          session.contextData[`${httpNode.data.responseVariable || 'http_response'}_error`] =
            err instanceof Error ? err.message : 'HTTP Request Failed'
        }

        const edge = flow.flowDefinition.edges.find((e) => e.source === node.id)
        currentNodeId = edge?.target || null
        if (!currentNodeId) {
          session.status = 'completed'
          break
        }
        continue
      }

      // 4. Branch Node (Conditional Routing)
      if (node.type === 'branch') {
        const branchNode = node as {
          data: {
            conditions?: Array<{
              variable: string
              operator: string
              value: unknown
              targetNodeId?: string
            }>
            branches?: Array<{
              conditions: Array<{ variable: string; operator: string; value: unknown }>
              targetNodeId: string
            }>
            fallbackNodeId?: string
          }
        }
        let branchTarget: string | null = null

        if (branchNode.data.conditions && Array.isArray(branchNode.data.conditions)) {
          for (const condition of branchNode.data.conditions) {
            if (this.evaluateCondition(condition, session.contextData)) {
              branchTarget = condition.targetNodeId || null
              break
            }
          }
        } else if (branchNode.data.branches && Array.isArray(branchNode.data.branches)) {
          for (const branch of branchNode.data.branches) {
            const matches = branch.conditions.every(
              (cond: { variable: string; operator: string; value: unknown }) =>
                this.evaluateCondition(cond, session.contextData),
            )
            if (matches) {
              branchTarget = branch.targetNodeId
              break
            }
          }
        }

        if (!branchTarget) {
          branchTarget = branchNode.data.fallbackNodeId || null
        }

        currentNodeId = branchTarget
        if (!currentNodeId) {
          session.status = 'completed'
          break
        }
        continue
      }

      // 5. Handoff Node (Escalation to Human Agent)
      if (node.type === 'handoff') {
        const handoffNode = node as HandoffNode
        session.status = 'handoff'

        // Determine ticket to update
        let ticketId = session.contextData._ticketId as string | undefined
        if (!ticketId && session.conversationId) {
          const tickets = await ticketService.listTickets({
            conversationId: session.conversationId,
          })
          const activeTicket = tickets.find((t) => t.status !== 'resolved')
          if (activeTicket) {
            ticketId = activeTicket.id
          }
        }

        if (ticketId) {
          await ticketService.updateTicketStatus(ticketId, 'open')
          const updates: Record<string, unknown> = {}
          if (handoffNode.data.teamId) {
            updates.teamId = handoffNode.data.teamId
          }
          if (handoffNode.data.priority) {
            updates.priority = handoffNode.data.priority
          }
          if (handoffNode.data.assigneeId) {
            updates.assigneeId = handoffNode.data.assigneeId
          }
          if (Object.keys(updates).length > 0) {
            await ticketService.updateTicket(ticketId, updates)
          }
        }

        if (handoffNode.data.handoffMessage) {
          messages.push({
            id: crypto.randomUUID(),
            text: handoffNode.data.handoffMessage,
          })
        }

        realtimeService.broadcast({
          event: 'bot.handoff',
          data: {
            sessionId: session.id,
            conversationId: session.conversationId,
            ticketId,
            teamId: handoffNode.data.teamId,
          },
        })

        currentNodeId = null
        break
      }

      break
    }

    session.currentNodeId = currentNodeId
    if (!currentNodeId && session.status !== 'handoff') {
      session.status = 'completed'
    }

    await this.saveSessionState(session)
    return { session, messages }
  }

  /**
   * Evaluate individual branch condition
   */
  private evaluateCondition(
    condition: { variable: string; operator: string; value: unknown },
    context: Record<string, unknown>,
  ): boolean {
    const val = context[condition.variable]
    const expected = condition.value

    switch (condition.operator) {
      case 'equals':
      case 'eq':
        return String(val) === String(expected)
      case 'not_equals':
      case 'neq':
        return String(val) !== String(expected)
      case 'greater_than':
      case 'gt':
        return Number(val) > Number(expected)
      case 'less_than':
      case 'lt':
        return Number(val) < Number(expected)
      case 'gte':
        return Number(val) >= Number(expected)
      case 'lte':
        return Number(val) <= Number(expected)
      case 'contains':
        return String(val || '')
          .toLowerCase()
          .includes(String(expected || '').toLowerCase())
      case 'not_contains':
        return !String(val || '')
          .toLowerCase()
          .includes(String(expected || '').toLowerCase())
      case 'is_empty':
        return val === undefined || val === null || val === ''
      case 'is_not_empty':
        return val !== undefined && val !== null && val !== ''
      default:
        return false
    }
  }

  /**
   * Persist session state to database
   */
  private async saveSessionState(session: BotSession): Promise<void> {
    const now = new Date().toISOString()
    await sql`
      UPDATE bot_sessions
      SET current_node_id = ${session.currentNodeId},
          status = ${session.status},
          context_data = ${JSON.stringify(session.contextData)},
          updated_at = ${now}
      WHERE id = ${session.id}
    `
  }
}

export const botEngineService = new BotEngineService()
