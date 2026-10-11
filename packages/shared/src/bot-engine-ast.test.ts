import { describe, expect, it } from 'bun:test'
import {
  type BotEdge,
  BotEdgeSchema,
  type BotFlow,
  BotFlowDefinitionSchema,
  BotFlowSchema,
  type BotNode,
  BotNodeSchema,
  BotNodeTypeSchema,
  type BotSession,
  BotSessionSchema,
  BotSessionStatusSchema,
  BotTriggerTypeSchema,
  type BranchNode,
  BranchNodeSchema,
  CreateBotFlowInputSchema,
  type HandoffNode,
  HandoffNodeSchema,
  type HttpNode,
  HttpNodeSchema,
  type MessageNode,
  MessageNodeSchema,
  type QuestionNode,
  QuestionNodeSchema,
  UpdateBotFlowInputSchema,
} from './index'

describe('Visual Bot Engine AST Nodes & Edges (Phase 2 - Task 2.9)', () => {
  describe('AST Node Types and Schemas', () => {
    it('should validate MessageNode correctly', () => {
      const messageNode: MessageNode = {
        id: 'node_msg_1',
        type: 'message',
        name: 'Welcome Greeting',
        data: {
          text: 'Halo! Selamat datang di layanan pelanggan Xatxoot.',
          mediaUrl: 'https://example.com/banner.png',
          mediaType: 'image',
        },
      }

      const parseResult = MessageNodeSchema.safeParse(messageNode)
      expect(parseResult.success).toBe(true)
      if (parseResult.success) {
        expect(parseResult.data.type).toBe('message')
        expect(parseResult.data.data.text).toContain('Selamat datang')
        expect(parseResult.data.data.mediaType).toBe('image')
      }

      const unionResult = BotNodeSchema.safeParse(messageNode)
      expect(unionResult.success).toBe(true)
    })

    it('should reject MessageNode with empty text', () => {
      const invalid = {
        id: 'node_msg_2',
        type: 'message',
        data: {
          text: '',
        },
      }
      expect(MessageNodeSchema.safeParse(invalid).success).toBe(false)
    })

    it('should validate QuestionNode with choices and variableName', () => {
      const questionNode: QuestionNode = {
        id: 'node_quest_1',
        type: 'question',
        name: 'Inquiry Selection',
        data: {
          question: 'Silakan pilih jenis bantuan yang Anda butuhkan:',
          questionType: 'choice',
          variableName: 'inquiry_category',
          options: [
            { id: 'opt_1', label: '1. Layanan Billing', value: 'billing' },
            { id: 'opt_2', label: '2. Bantuan Teknis', value: 'tech_support' },
            { id: 'opt_3', label: '3. Informasi Produk', value: 'sales' },
          ],
        },
      }

      const parseResult = QuestionNodeSchema.safeParse(questionNode)
      expect(parseResult.success).toBe(true)
      if (parseResult.success) {
        expect(parseResult.data.type).toBe('question')
        expect(parseResult.data.data.variableName).toBe('inquiry_category')
        expect(parseResult.data.data.options).toHaveLength(3)
      }

      const unionResult = BotNodeSchema.safeParse(questionNode)
      expect(unionResult.success).toBe(true)
    })

    it('should reject QuestionNode missing variableName', () => {
      const invalid = {
        id: 'node_quest_2',
        type: 'question',
        data: {
          question: 'Siapa nama Anda?',
          variableName: '',
        },
      }
      expect(QuestionNodeSchema.safeParse(invalid).success).toBe(false)
    })

    it('should validate HttpNode with method, headers, and responseVariable', () => {
      const httpNode: HttpNode = {
        id: 'node_http_1',
        type: 'http',
        name: 'Fetch Order Status',
        data: {
          url: 'https://api.internal.com/v1/orders/check',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token_abc',
          },
          body: JSON.stringify({ orderId: '{{order_id}}' }),
          responseVariable: 'order_api_response',
          timeoutMs: 3000,
        },
      }

      const parseResult = HttpNodeSchema.safeParse(httpNode)
      expect(parseResult.success).toBe(true)
      if (parseResult.success) {
        expect(parseResult.data.type).toBe('http')
        expect(parseResult.data.data.method).toBe('POST')
        expect(parseResult.data.data.responseVariable).toBe('order_api_response')
        expect(parseResult.data.data.timeoutMs).toBe(3000)
      }

      const unionResult = BotNodeSchema.safeParse(httpNode)
      expect(unionResult.success).toBe(true)
    })

    it('should reject HttpNode with invalid URL', () => {
      const invalid = {
        id: 'node_http_2',
        type: 'http',
        data: {
          url: 'invalid-url',
          responseVariable: 'res',
        },
      }
      expect(HttpNodeSchema.safeParse(invalid).success).toBe(false)
    })

    it('should validate BranchNode with conditions and fallback', () => {
      const branchNode: BranchNode = {
        id: 'node_branch_1',
        type: 'branch',
        name: 'Check Category Router',
        data: {
          conditions: [
            {
              id: 'cond_1',
              variable: 'inquiry_category',
              operator: 'equals',
              value: 'billing',
              targetNodeId: 'node_billing_flow',
            },
            {
              id: 'cond_2',
              variable: 'inquiry_category',
              operator: 'equals',
              value: 'tech_support',
              targetNodeId: 'node_handoff_tech',
            },
          ],
          fallbackNodeId: 'node_handoff_general',
        },
      }

      const parseResult = BranchNodeSchema.safeParse(branchNode)
      expect(parseResult.success).toBe(true)
      if (parseResult.success) {
        expect(parseResult.data.type).toBe('branch')
        expect(parseResult.data.data.conditions).toHaveLength(2)
        expect(parseResult.data.data.fallbackNodeId).toBe('node_handoff_general')
      }

      const unionResult = BotNodeSchema.safeParse(branchNode)
      expect(unionResult.success).toBe(true)
    })

    it('should reject BranchNode without conditions', () => {
      const invalid = {
        id: 'node_branch_2',
        type: 'branch',
        data: {
          conditions: [],
        },
      }
      expect(BranchNodeSchema.safeParse(invalid).success).toBe(false)
    })

    it('should validate HandoffNode with target team and priority', () => {
      const handoffNode: HandoffNode = {
        id: 'node_handoff_1',
        type: 'handoff',
        name: 'Handoff to Support Agent',
        data: {
          teamId: '123e4567-e89b-12d3-a456-426614174000',
          assigneeId: null,
          handoffMessage: 'Mohon tunggu sejenak, agen kami akan segera merespons tiket Anda.',
          priority: 'high',
        },
      }

      const parseResult = HandoffNodeSchema.safeParse(handoffNode)
      expect(parseResult.success).toBe(true)
      if (parseResult.success) {
        expect(parseResult.data.type).toBe('handoff')
        expect(parseResult.data.data.priority).toBe('high')
        expect(parseResult.data.data.handoffMessage).toContain('agen kami akan segera merespons')
      }

      const unionResult = BotNodeSchema.safeParse(handoffNode)
      expect(unionResult.success).toBe(true)
    })
  })

  describe('AST Edge Schema', () => {
    it('should validate BotEdge connecting source and target nodes', () => {
      const edge: BotEdge = {
        id: 'edge_1',
        source: 'node_msg_1',
        target: 'node_quest_1',
        sourceHandle: 'output_default',
        targetHandle: 'input_default',
        label: 'Next Step',
      }

      const result = BotEdgeSchema.safeParse(edge)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.source).toBe('node_msg_1')
        expect(result.data.target).toBe('node_quest_1')
      }
    })

    it('should reject BotEdge missing source or target', () => {
      expect(
        BotEdgeSchema.safeParse({
          id: 'edge_invalid',
          source: '',
          target: 'node_2',
        }).success,
      ).toBe(false)
    })
  })

  describe('BotFlowDefinition AST Graph Integration', () => {
    it('should validate complete BotFlowDefinition with nodes, edges, and startNodeId', () => {
      const flowDef = {
        startNodeId: 'node_welcome',
        nodes: [
          {
            id: 'node_welcome',
            type: 'message',
            name: 'Welcome',
            data: { text: 'Halo! Selamat datang.' },
          },
          {
            id: 'node_choose',
            type: 'question',
            name: 'Pilih Menu',
            data: {
              question: 'Pilih opsi:',
              questionType: 'choice',
              variableName: 'menu_choice',
              options: [{ id: 'opt_a', label: 'A', value: 'a' }],
            },
          },
          {
            id: 'node_handoff',
            type: 'handoff',
            name: 'Selesai & Handoff',
            data: {
              priority: 'medium',
              handoffMessage: 'Menghubungkan ke staf...',
            },
          },
        ],
        edges: [
          {
            id: 'edge_1_2',
            source: 'node_welcome',
            target: 'node_choose',
          },
          {
            id: 'edge_2_3',
            source: 'node_choose',
            target: 'node_handoff',
          },
        ],
        variables: {
          default_locale: 'id',
        },
      }

      const result = BotFlowDefinitionSchema.safeParse(flowDef)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.startNodeId).toBe('node_welcome')
        expect(result.data.nodes).toHaveLength(3)
        expect(result.data.edges).toHaveLength(2)
      }
    })
  })

  describe('BotFlow and BotSession Entities', () => {
    it('should validate CreateBotFlowInput and BotFlowSchema', () => {
      const flowInput = {
        name: 'CS Triage Bot Flow',
        triggerType: 'conversation_opened',
        active: true,
        flowDefinition: {
          startNodeId: 'start_node',
          nodes: [
            {
              id: 'start_node',
              type: 'message',
              data: { text: 'Halo!' },
            },
          ],
          edges: [],
        },
      }

      const inputResult = CreateBotFlowInputSchema.safeParse(flowInput)
      expect(inputResult.success).toBe(true)

      const updateResult = UpdateBotFlowInputSchema.safeParse({ active: false })
      expect(updateResult.success).toBe(true)

      const fullFlow: BotFlow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: flowInput.name,
        triggerType: 'conversation_opened',
        active: true,
        flowDefinition: flowInput.flowDefinition,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const flowResult = BotFlowSchema.safeParse(fullFlow)
      expect(flowResult.success).toBe(true)
    })

    it('should validate BotSession entity schema', () => {
      const session: BotSession = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        conversationId: '123e4567-e89b-12d3-a456-426614174002',
        flowId: '123e4567-e89b-12d3-a456-426614174003',
        currentNodeId: 'node_choose',
        status: 'active',
        contextData: {
          user_input: 'billing',
          step_count: 2,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = BotSessionSchema.safeParse(session)
      expect(result.success).toBe(true)
    })
  })

  describe('Single Organization & Ubiquitous Language Integrity', () => {
    it('should NOT contain account_id in any bot schema', () => {
      const sample = {
        name: 'Bot Flow',
        account_id: 'forbidden_tenant',
        flowDefinition: {
          startNodeId: 'node1',
          nodes: [{ id: 'node1', type: 'message', data: { text: 'Hi' } }],
          edges: [],
        },
      }

      const parsed = CreateBotFlowInputSchema.safeParse(sample)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect((parsed.data as Record<string, unknown>).account_id).toBeUndefined()
      }
    })

    it('should verify Phase 2 checklist marks Task 2.9 as completed', () => {
      const checklistPath = new URL('../../../docs/PHASE_2_CHECKLIST.md', import.meta.url).pathname
      const fs = require('node:fs')
      const checklistContent = fs.readFileSync(checklistPath, 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 2.9**: Definisi AST node & edge untuk Visual Bot Engine (MessageNode, QuestionNode, HttpNode, BranchNode, HandoffNode).',
      )
    })
  })
})
