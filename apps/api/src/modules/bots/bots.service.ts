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
import { sql } from '../../db'
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

interface BotMemoryStore {
  flows: Map<string, BotFlow>
  sessions: Map<string, BotSession>
  lastOutputs: Map<string, BotEmittedMessage[]> // sessionId -> messages
}

const memoryStore: BotMemoryStore = {
  flows: new Map(),
  sessions: new Map(),
  lastOutputs: new Map(),
}

export function resetBotStore(): void {
  memoryStore.flows.clear()
  memoryStore.sessions.clear()
  memoryStore.lastOutputs.clear()
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
  /**
   * Create a new Bot Flow
   */
  async createFlow(input: CreateBotFlowInput): Promise<BotFlow> {
    const parsed = CreateBotFlowInputSchema.parse(input)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const flow: BotFlow = {
      id,
      name: parsed.name,
      triggerType: parsed.triggerType || 'conversation_opened',
      active: parsed.active ?? true,
      flowDefinition: parsed.flowDefinition,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await sql`
        INSERT INTO bot_flows (
          id, name, trigger_type, active, flow_definition, created_at, updated_at
        ) VALUES (
          ${flow.id}, ${flow.name}, ${flow.triggerType}, ${flow.active},
          ${JSON.stringify(flow.flowDefinition)}, ${now}, ${now}
        )
      `
    } catch {
      // Memory fallback
    }

    memoryStore.flows.set(id, flow)
    return flow
  }

  /**
   * List all bot flows
   */
  async listFlows(): Promise<BotFlow[]> {
    try {
      const rows = await sql`
        SELECT id, name, trigger_type AS "triggerType", active,
               flow_definition AS "flowDefinition", created_at AS "createdAt", updated_at AS "updatedAt"
        FROM bot_flows
        ORDER BY created_at DESC
      `
      if (rows && rows.length > 0) {
        return rows as unknown as BotFlow[]
      }
    } catch {
      // Memory fallback
    }

    return Array.from(memoryStore.flows.values())
  }

  /**
   * Get bot flow by ID
   */
  async getFlowById(id: string): Promise<BotFlow | null> {
    const inMem = memoryStore.flows.get(id)
    if (inMem) return inMem

    try {
      const rows = await sql`
        SELECT id, name, trigger_type AS "triggerType", active,
               flow_definition AS "flowDefinition", created_at AS "createdAt", updated_at AS "updatedAt"
        FROM bot_flows
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as BotFlow
      }
    } catch {
      // Memory fallback
    }

    return null
  }

  /**
   * Update bot flow
   */
  async updateFlow(id: string, input: UpdateBotFlowInput): Promise<BotFlow | null> {
    const existing = await this.getFlowById(id)
    if (!existing) return null

    const now = new Date().toISOString()
    const updated: BotFlow = {
      ...existing,
      name: input.name ?? existing.name,
      triggerType: input.triggerType ?? existing.triggerType,
      active: input.active !== undefined ? input.active : existing.active,
      flowDefinition: input.flowDefinition ?? existing.flowDefinition,
      updatedAt: now,
    }

    try {
      await sql`
        UPDATE bot_flows
        SET name = ${updated.name},
            trigger_type = ${updated.triggerType},
            active = ${updated.active},
            flow_definition = ${JSON.stringify(updated.flowDefinition)},
            updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    memoryStore.flows.set(id, updated)
    return updated
  }

  /**
   * Delete bot flow
   */
  async deleteFlow(id: string): Promise<boolean> {
    const existing = await this.getFlowById(id)
    if (!existing) return false

    try {
      await sql`DELETE FROM bot_flows WHERE id = ${id}`
    } catch {
      // Memory fallback
    }

    memoryStore.flows.delete(id)
    return true
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

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const contextData: Record<string, unknown> = {
      ...(flow.flowDefinition.variables || {}),
      ...(options?.initialContext || {}),
    }

    if (options?.ticketId) {
      contextData._ticketId = options.ticketId
    }

    let session: BotSession = {
      id,
      conversationId,
      flowId,
      currentNodeId: flow.flowDefinition.startNodeId,
      status: 'active',
      contextData,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.sessions.set(id, session)

    try {
      await sql`
        INSERT INTO bot_sessions (
          id, conversation_id, flow_id, current_node_id, status, context_data, created_at, updated_at
        ) VALUES (
          ${session.id}, ${session.conversationId}, ${session.flowId},
          ${session.currentNodeId}, ${session.status}, ${JSON.stringify(session.contextData)},
          ${now}, ${now}
        )
      `
    } catch {
      // Memory fallback
    }

    // Immediately execute graph starting from startNodeId until it needs input or reaches terminal
    const execResult = await this.executeGraphStep(session, flow, null)
    session = execResult.session
    memoryStore.lastOutputs.set(id, execResult.messages)

    return session
  }

  /**
   * Get bot session by ID
   */
  async getSessionById(id: string): Promise<BotSession | null> {
    const inMem = memoryStore.sessions.get(id)
    if (inMem) return inMem

    try {
      const rows = await sql`
        SELECT id, conversation_id AS "conversationId", flow_id AS "flowId",
               current_node_id AS "currentNodeId", status, context_data AS "contextData",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM bot_sessions
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as BotSession
      }
    } catch {
      // Memory fallback
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
    const messages = memoryStore.lastOutputs.get(sessionId) || []
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

    memoryStore.lastOutputs.set(sessionId, execResult.messages)
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
          mediaUrl: msgNode.data.mediaUrl ?? null,
          mediaType: msgNode.data.mediaType ?? null,
        })

        // Move to next node connected via edge
        const nextEdge = flow.flowDefinition.edges.find((e) => e.source === node.id)
        currentNodeId = nextEdge ? nextEdge.target : null
        if (!currentNodeId) {
          session.status = 'completed'
          break
        }
        continue
      }

      // 2. Question Node
      if (node.type === 'question') {
        const qNode = node as QuestionNode

        if (isHandlingInput) {
          // Process and validate user response
          const qType = qNode.data.questionType || 'text'
          let chosenNextNodeId: string | null = null

          if (qType === 'choice' && qNode.data.options && qNode.data.options.length > 0) {
            const raw = (userInput || '').trim().toLowerCase()
            // Check 1-based index or value or label
            let matched = qNode.data.options.find(
              (opt) =>
                opt.value.toLowerCase() === raw ||
                opt.label.toLowerCase() === raw ||
                opt.id.toLowerCase() === raw,
            )

            if (!matched) {
              const num = Number.parseInt(raw, 10)
              if (!Number.isNaN(num) && num >= 1 && num <= qNode.data.options.length) {
                matched = qNode.data.options[num - 1]
              }
            }

            if (matched) {
              session.contextData[qNode.data.variableName] = matched.value

              // Check if any edge has sourceHandle matching option ID / value
              const specificEdge = flow.flowDefinition.edges.find(
                (e) =>
                  e.source === node.id &&
                  (e.sourceHandle === matched.id || e.sourceHandle === matched.value),
              )
              if (specificEdge) {
                chosenNextNodeId = specificEdge.target
              }
            } else {
              // Fallback: save raw input
              session.contextData[qNode.data.variableName] = userInput
            }
          } else if (qType === 'number') {
            const num = Number(userInput)
            session.contextData[qNode.data.variableName] = Number.isNaN(num) ? userInput : num
          } else {
            session.contextData[qNode.data.variableName] = userInput
          }

          // Advance past question node
          isHandlingInput = false
          if (chosenNextNodeId) {
            currentNodeId = chosenNextNodeId
          } else {
            const nextEdge = flow.flowDefinition.edges.find((e) => e.source === node.id)
            currentNodeId = nextEdge ? nextEdge.target : null
          }

          if (!currentNodeId) {
            session.status = 'completed'
            break
          }
          continue
        }

        // Emit question prompt and pause execution for user response
        const questionText = interpolateVariables(qNode.data.question, session.contextData)

        messages.push({
          id: crypto.randomUUID(),
          text: questionText,
        })

        session.currentNodeId = node.id
        session.status = 'active'
        await this.saveSessionState(session)
        return { session, messages }
      }

      // 3. HTTP Node (Asynchronous Webhook Execution)
      if (node.type === 'http') {
        const httpNode = node as HttpNode
        const interpolatedUrl = interpolateVariables(httpNode.data.url, session.contextData)
        const interpolatedBody = httpNode.data.body
          ? interpolateVariables(httpNode.data.body, session.contextData)
          : undefined

        try {
          const timeoutMs = httpNode.data.timeoutMs || 5000
          const res = await fetch(interpolatedUrl, {
            method: httpNode.data.method || 'GET',
            headers: httpNode.data.headers || {},
            body: interpolatedBody,
            signal: AbortSignal.timeout(timeoutMs),
          })

          const contentType = res.headers.get('content-type') || ''
          let responseData: unknown = null
          if (contentType.includes('application/json')) {
            responseData = await res.json()
          } else {
            responseData = await res.text()
          }

          session.contextData[httpNode.data.responseVariable] = responseData
        } catch (error) {
          session.contextData[httpNode.data.responseVariable] = {
            error: error instanceof Error ? error.message : 'HTTP execution failed',
          }
        }

        const nextEdge = flow.flowDefinition.edges.find((e) => e.source === node.id)
        currentNodeId = nextEdge ? nextEdge.target : null
        if (!currentNodeId) {
          session.status = 'completed'
          break
        }
        continue
      }

      // 4. Branch Node (Condition Evaluation)
      if (node.type === 'branch') {
        const branchNode = node as BranchNode
        let branchTarget: string | null = null

        for (const condition of branchNode.data.conditions) {
          if (this.evaluateCondition(condition, session.contextData)) {
            branchTarget = condition.targetNodeId || null
            break
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
          if (handoffNode.data.teamId) {
            // Update team assignment
            const ticket = await ticketService.getTicketById(ticketId)
            if (ticket) {
              ticket.teamId = handoffNode.data.teamId
              if (handoffNode.data.priority) {
                ticket.priority = handoffNode.data.priority
              }
              if (handoffNode.data.assigneeId) {
                ticket.assigneeId = handoffNode.data.assigneeId
              }
            }
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
    condition: BranchConditionRule,
    context: Record<string, unknown>,
  ): boolean {
    const val = context[condition.variable]
    const targetVal = condition.value

    switch (condition.operator) {
      case 'equals':
        return String(val) === String(targetVal)
      case 'not_equals':
        return String(val) !== String(targetVal)
      case 'contains':
        return String(val).toLowerCase().includes(String(targetVal).toLowerCase())
      case 'greater_than':
        return Number(val) > Number(targetVal)
      case 'less_than':
        return Number(val) < Number(targetVal)
      case 'is_empty':
        return val === undefined || val === null || val === ''
      case 'is_not_empty':
        return val !== undefined && val !== null && val !== ''
      default:
        return false
    }
  }

  /**
   * Save session state to DB and memory
   */
  private async saveSessionState(session: BotSession): Promise<void> {
    const now = new Date().toISOString()
    session.updatedAt = now
    memoryStore.sessions.set(session.id, session)

    try {
      await sql`
        UPDATE bot_sessions
        SET current_node_id = ${session.currentNodeId},
            status = ${session.status},
            context_data = ${JSON.stringify(session.contextData)},
            updated_at = ${now}
        WHERE id = ${session.id}
      `
    } catch {
      // Memory fallback
    }
  }
}

export const botEngineService = new BotEngineService()
