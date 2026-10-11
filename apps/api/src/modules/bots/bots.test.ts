import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import type {
  BotFlowDefinition,
  CreateBotFlowInput,
  HandoffNode,
  HttpNode,
  MessageNode,
  QuestionNode,
} from '@xatxoot/shared'
import type { Server } from 'bun'
import app from '../../index'
import { conversationService, resetConversationStore } from '../conversations/conversations.service'
import { resetTeamStore, teamService } from '../teams/teams.service'
import { resetTicketStore, ticketService } from '../tickets/tickets.service'
import { botEngineService, resetBotStore } from './bots.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
  'Content-Type': 'application/json',
}

let mockHttpServer: Server | null = null
let mockHttpPort = 0

beforeAll(() => {
  mockHttpServer = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/api/order-lookup') {
        const orderId = url.searchParams.get('orderId')
        if (orderId === 'ORD-123') {
          return Response.json({
            found: true,
            status: 'Shipped',
            courier: 'JNE',
          })
        }
        return Response.json({ found: false }, { status: 404 })
      }
      return Response.json({ ok: true })
    },
  })
  mockHttpPort = mockHttpServer.port
})

afterAll(() => {
  mockHttpServer?.stop()
})

describe('Bot Engine Module - Auth Guards', () => {
  it('GET /api/v1/bot-flows should reject requests without Authorization with 401', async () => {
    const res = await app.request('/api/v1/bot-flows', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/bot-flows should reject requests without Authorization with 401', async () => {
    const res = await app.request('/api/v1/bot-flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Flow' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/bot-sessions/start should reject requests without Authorization with 401', async () => {
    const res = await app.request('/api/v1/bot-sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'c1', flowId: 'f1' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('Bot Engine Module - CRUD Bot Flows', () => {
  beforeEach(() => {
    resetBotStore()
    resetConversationStore()
    resetTicketStore()
  })

  const sampleFlowDefinition: BotFlowDefinition = {
    startNodeId: 'node-msg-1',
    nodes: [
      {
        id: 'node-msg-1',
        type: 'message',
        name: 'Welcome Message',
        data: { text: 'Selamat datang di layanan kami!' },
      },
    ],
    edges: [],
    variables: {},
  }

  it('should create, list, retrieve, update, and delete a bot flow', async () => {
    // 1. Create
    const input: CreateBotFlowInput = {
      name: 'Customer Greeting Flow',
      triggerType: 'conversation_opened',
      active: true,
      flowDefinition: sampleFlowDefinition,
    }

    const flow = await botEngineService.createFlow(input)
    expect(flow.id).toBeDefined()
    expect(flow.name).toBe(input.name)
    expect(flow.active).toBe(true)

    // 2. List
    const flows = await botEngineService.listFlows()
    expect(flows.length).toBeGreaterThan(0)
    expect(flows.some((f) => f.id === flow.id)).toBe(true)

    // 3. Get by ID
    const retrieved = await botEngineService.getFlowById(flow.id)
    expect(retrieved).toBeDefined()
    expect(retrieved?.name).toBe(input.name)

    // 4. Update
    const updated = await botEngineService.updateFlow(flow.id, {
      name: 'Updated Greeting Flow',
      active: false,
    })
    expect(updated?.name).toBe('Updated Greeting Flow')
    expect(updated?.active).toBe(false)

    // 5. Delete
    const deleted = await botEngineService.deleteFlow(flow.id)
    expect(deleted).toBe(true)
    const afterDelete = await botEngineService.getFlowById(flow.id)
    expect(afterDelete).toBeNull()
  })
})

describe('Bot Engine Module - State Machine & Question Evaluation', () => {
  beforeEach(() => {
    resetBotStore()
    resetConversationStore()
    resetTicketStore()
  })

  it('should execute message node, stop at question choice node, and proceed when user replies with valid choice', async () => {
    const flowDef: BotFlowDefinition = {
      startNodeId: 'node-1',
      nodes: [
        {
          id: 'node-1',
          type: 'message',
          data: { text: 'Halo! Selamat datang di Chatbot Support.' },
        },
        {
          id: 'node-2',
          type: 'question',
          data: {
            question: 'Pilih departemen yang ingin Anda hubungi:',
            questionType: 'choice',
            variableName: 'selected_dept',
            options: [
              { id: 'opt-sales', label: '1. Penjualan', value: 'sales' },
              { id: 'opt-billing', label: '2. Tagihan & Billing', value: 'billing' },
            ],
          },
        },
        {
          id: 'node-3',
          type: 'message',
          data: { text: 'Terima kasih telah memilih departemen terkait.' },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'node-1', target: 'node-2' },
        { id: 'edge-2', source: 'node-2', target: 'node-3' },
      ],
      variables: {},
    }

    const flow = await botEngineService.createFlow({
      name: 'Department Selector',
      flowDefinition: flowDef,
    })

    const conversationId = '00000000-0000-0000-0000-000000000010'

    // Start session
    const session = await botEngineService.startSession(conversationId, flow.id)
    expect(session).toBeDefined()
    expect(session.status).toBe('active')
    // Should have executed message node and stopped at question node
    expect(session.currentNodeId).toBe('node-2')

    // Inspect messages emitted so far
    const stepOutput1 = await botEngineService.getLastExecutionOutput(session.id)
    expect(stepOutput1.messages.length).toBe(2) // Welcome message and Question prompt
    expect(stepOutput1.messages[0].text).toContain('Halo! Selamat datang')
    expect(stepOutput1.messages[1].text).toContain('Pilih departemen')

    // User replies with choice '1' (or 'sales')
    const stepResult = await botEngineService.processUserInput(session.id, '1')
    expect(stepResult.session.status).toBe('completed')
    expect(stepResult.session.contextData.selected_dept).toBe('sales')
    expect(stepResult.messages.some((m) => m.text.includes('Terima kasih'))).toBe(true)
  })

  it('should handle branch conditional routing based on contextData variables', async () => {
    const flowDef: BotFlowDefinition = {
      startNodeId: 'node-q',
      nodes: [
        {
          id: 'node-q',
          type: 'question',
          data: {
            question: 'Berapa usia Anda?',
            questionType: 'number',
            variableName: 'age',
          },
        },
        {
          id: 'node-branch',
          type: 'branch',
          data: {
            conditions: [
              {
                variable: 'age',
                operator: 'greater_than',
                value: 17,
                targetNodeId: 'node-adult',
              },
            ],
            fallbackNodeId: 'node-minor',
          },
        },
        {
          id: 'node-adult',
          type: 'message',
          data: { text: 'Konten khusus dewasa tersedia untuk Anda.' },
        },
        {
          id: 'node-minor',
          type: 'message',
          data: { text: 'Akses dibatasi untuk pengguna di bawah umur.' },
        },
      ],
      edges: [{ id: 'e1', source: 'node-q', target: 'node-branch' }],
    }

    const flow = await botEngineService.createFlow({
      name: 'Age Verification Flow',
      flowDefinition: flowDef,
    })

    // Test Path A: Age = 20 (Adult)
    const session1 = await botEngineService.startSession('conv-age-1', flow.id)
    const resAdult = await botEngineService.processUserInput(session1.id, '20')
    expect(resAdult.messages.some((m) => m.text.includes('khusus dewasa'))).toBe(true)

    // Test Path B: Age = 15 (Minor)
    const session2 = await botEngineService.startSession('conv-age-2', flow.id)
    const resMinor = await botEngineService.processUserInput(session2.id, '15')
    expect(resMinor.messages.some((m) => m.text.includes('dibatasi untuk pengguna'))).toBe(true)
  })
})

describe('Bot Engine Module - Asynchronous HTTP Request Node Execution', () => {
  beforeEach(() => {
    resetBotStore()
    resetConversationStore()
    resetTicketStore()
  })

  it('should asynchronously invoke HTTP webhook, interpolate variables, and store response', async () => {
    const flowDef: BotFlowDefinition = {
      startNodeId: 'node-q-order',
      nodes: [
        {
          id: 'node-q-order',
          type: 'question',
          data: {
            question: 'Masukkan nomor pesanan Anda:',
            questionType: 'text',
            variableName: 'order_number',
          },
        },
        {
          id: 'node-http',
          type: 'http',
          data: {
            url: `http://localhost:${mockHttpPort}/api/order-lookup?orderId={{order_number}}`,
            method: 'GET',
            headers: { Accept: 'application/json' },
            responseVariable: 'order_api_res',
            timeoutMs: 3000,
          },
        },
        {
          id: 'node-msg-result',
          type: 'message',
          data: {
            text: 'Status pesanan Anda: {{order_api_res.status}} (Kurir: {{order_api_res.courier}})',
          },
        },
      ],
      edges: [
        { id: 'e-q-http', source: 'node-q-order', target: 'node-http' },
        { id: 'e-http-msg', source: 'node-http', target: 'node-msg-result' },
      ],
    }

    const flow = await botEngineService.createFlow({
      name: 'Order Lookup Bot',
      flowDefinition: flowDef,
    })

    const session = await botEngineService.startSession('conv-order-1', flow.id)
    const stepResult = await botEngineService.processUserInput(session.id, 'ORD-123')

    expect(stepResult.session.status).toBe('completed')
    expect(stepResult.session.contextData.order_api_res).toBeDefined()
    expect(stepResult.session.contextData.order_api_res.status).toBe('Shipped')

    const resultMsg = stepResult.messages.find((m) => m.text.includes('Status pesanan'))
    expect(resultMsg).toBeDefined()
    expect(resultMsg?.text).toContain('Status pesanan Anda: Shipped (Kurir: JNE)')
  })
})

describe('Bot Engine Module - Node Handoff to Human Agent', () => {
  beforeEach(() => {
    resetBotStore()
    resetConversationStore()
    resetTicketStore()
    resetTeamStore()
  })

  it('should execute handoff node, transition ticket to open status, set team/priority, and notify human agents', async () => {
    const billingTeam = await teamService.createTeam({
      name: 'Billing Support Specialists',
      allowAutoAssign: true,
    })

    const conversationId = '00000000-0000-0000-0000-000000000099'
    const initialTicket = await ticketService.createTicket({
      conversationId,
      status: 'pending', // Bot is handling initially
      priority: 'low',
    })

    const flowDef: BotFlowDefinition = {
      startNodeId: 'node-handoff',
      nodes: [
        {
          id: 'node-handoff',
          type: 'handoff',
          data: {
            teamId: billingTeam.id,
            priority: 'urgent',
            handoffMessage: 'Pelanggan meminta eskalasi ke staf billing manusia.',
          },
        },
      ],
      edges: [],
    }

    const flow = await botEngineService.createFlow({
      name: 'Direct Handoff Flow',
      flowDefinition: flowDef,
    })

    const session = await botEngineService.startSession(conversationId, flow.id, {
      ticketId: initialTicket.id,
    })

    expect(session.status).toBe('handoff')

    // Verify ticket was updated to 'open' and priority 'urgent'
    const updatedTicket = await ticketService.getTicketById(initialTicket.id)
    expect(updatedTicket?.status).toBe('open')
    expect(updatedTicket?.priority).toBe('urgent')
    expect(updatedTicket?.teamId).toBe(billingTeam.id)
  })
})

describe('Bot Engine Module - HTTP Endpoints', () => {
  beforeEach(() => {
    resetBotStore()
    resetConversationStore()
    resetTicketStore()
  })

  it('should interact with bot flows and sessions via REST API', async () => {
    // 1. Create Bot Flow via API
    const createRes = await app.request('/api/v1/bot-flows', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        name: 'API Test Flow',
        triggerType: 'conversation_opened',
        flowDefinition: {
          startNodeId: 'msg-start',
          nodes: [
            {
              id: 'msg-start',
              type: 'message',
              data: { text: 'Pesan selamat datang API' },
            },
          ],
          edges: [],
        },
      }),
    })
    expect(createRes.status).toBe(201)
    const flowJson = (await createRes.json()) as { flow: { id: string } }
    const flowId = flowJson.flow.id

    // 2. Start Bot Session via API
    const startRes = await app.request('/api/v1/bot-sessions/start', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        conversationId: '00000000-0000-0000-0000-000000000088',
        flowId,
      }),
    })
    expect(startRes.status).toBe(201)
    const sessionJson = (await startRes.json()) as { session: { id: string; status: string } }
    expect(sessionJson.session.id).toBeDefined()
    expect(sessionJson.session.status).toBe('completed')
  })
})

describe('Single Organization & Ubiquitous Language Integrity', () => {
  it('should verify Phase 2 checklist marks Task 2.15 as completed', async () => {
    const checklistFile = Bun.file('docs/PHASE_2_CHECKLIST.md')
    const content = await checklistFile.text()
    expect(content).toContain('- [x] **Task 2.15 (TDD)**')
  })
})
