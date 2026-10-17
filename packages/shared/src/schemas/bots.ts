import { z } from 'zod'

// ==========================================
// Phase 2: Visual Bot Engine AST Nodes & Edges (Task 2.9)
// ==========================================

export const BotNodeTypeSchema = z.enum(['message', 'question', 'http', 'branch', 'handoff'])
export type BotNodeType = z.infer<typeof BotNodeTypeSchema>

// 1. MessageNode
export const MessageNodeDataSchema = z.object({
  text: z.string().min(1, 'Pesan teks wajib diisi'),
  mediaUrl: z.string().url().nullable().optional(),
  mediaType: z.enum(['image', 'video', 'document', 'audio']).nullable().optional(),
})
export type MessageNodeData = z.infer<typeof MessageNodeDataSchema>

export const MessageNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('message'),
  name: z.string().optional(),
  data: MessageNodeDataSchema,
})
export type MessageNode = z.infer<typeof MessageNodeSchema>

// 2. QuestionNode
export const QuestionChoiceOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
})
export type QuestionChoiceOption = z.infer<typeof QuestionChoiceOptionSchema>

export const QuestionNodeDataSchema = z.object({
  question: z.string().min(1, 'Teks pertanyaan wajib diisi'),
  questionType: z.enum(['text', 'choice', 'number', 'email', 'phone']).default('text'),
  variableName: z.string().min(1, 'Nama variabel wajib diisi'),
  options: z.array(QuestionChoiceOptionSchema).optional().default([]),
})
export type QuestionNodeData = z.infer<typeof QuestionNodeDataSchema>

export const QuestionNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('question'),
  name: z.string().optional(),
  data: QuestionNodeDataSchema,
})
export type QuestionNode = z.infer<typeof QuestionNodeSchema>

// 3. HttpNode
export const HttpNodeDataSchema = z.object({
  url: z.string().url('URL endpoint harus berupa URL valid'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  headers: z.record(z.string()).optional().default({}),
  body: z.string().nullable().optional(),
  responseVariable: z.string().min(1, 'Nama variabel penyimpan respons wajib diisi'),
  timeoutMs: z.number().int().positive().optional().default(5000),
})
export type HttpNodeData = z.infer<typeof HttpNodeDataSchema>

export const HttpNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('http'),
  name: z.string().optional(),
  data: HttpNodeDataSchema,
})
export type HttpNode = z.infer<typeof HttpNodeSchema>

// 4. BranchNode
export const BranchConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty',
])
export type BranchConditionOperator = z.infer<typeof BranchConditionOperatorSchema>

export const BranchConditionRuleSchema = z.object({
  id: z.string().optional(),
  variable: z.string().min(1, 'Variabel kondisi wajib diisi'),
  operator: BranchConditionOperatorSchema,
  value: z.any().optional(),
  targetNodeId: z.string().optional(),
})
export type BranchConditionRule = z.infer<typeof BranchConditionRuleSchema>

export const BranchNodeDataSchema = z.object({
  conditions: z.array(BranchConditionRuleSchema).min(1, 'Minimal satu kondisi wajib diisi'),
  fallbackNodeId: z.string().nullable().optional(),
})
export type BranchNodeData = z.infer<typeof BranchNodeDataSchema>

export const BranchNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('branch'),
  name: z.string().optional(),
  data: BranchNodeDataSchema,
})
export type BranchNode = z.infer<typeof BranchNodeSchema>

// 5. HandoffNode
export const HandoffNodeDataSchema = z.object({
  teamId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  handoffMessage: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
})
export type HandoffNodeData = z.infer<typeof HandoffNodeDataSchema>

export const HandoffNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('handoff'),
  name: z.string().optional(),
  data: HandoffNodeDataSchema,
})
export type HandoffNode = z.infer<typeof HandoffNodeSchema>

// Discriminated union of AST nodes
export const BotNodeSchema = z.discriminatedUnion('type', [
  MessageNodeSchema,
  QuestionNodeSchema,
  HttpNodeSchema,
  BranchNodeSchema,
  HandoffNodeSchema,
])
export type BotNode = z.infer<typeof BotNodeSchema>

// 6. BotEdge Schema
export const BotEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1, 'Source node ID wajib diisi'),
  target: z.string().min(1, 'Target node ID wajib diisi'),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
})
export type BotEdge = z.infer<typeof BotEdgeSchema>

// 7. BotFlowDefinition AST Graph Schema
export const BotFlowDefinitionSchema = z.object({
  startNodeId: z.string().min(1, 'Start node ID wajib diisi'),
  nodes: z.array(BotNodeSchema).min(1, 'Minimal satu node diperlukan'),
  edges: z.array(BotEdgeSchema).default([]),
  variables: z.record(z.any()).optional().default({}),
})
export type BotFlowDefinition = z.infer<typeof BotFlowDefinitionSchema>

// 8. BotFlow Entity & Input Schemas
export const BotTriggerTypeSchema = z.enum([
  'conversation_opened',
  'message_received',
  'manual',
  'custom',
])
export type BotTriggerType = z.infer<typeof BotTriggerTypeSchema>

export const CreateBotFlowInputSchema = z.object({
  name: z.string().min(1, 'Nama bot flow wajib diisi'),
  triggerType: BotTriggerTypeSchema.default('conversation_opened'),
  active: z.boolean().default(true),
  flowDefinition: BotFlowDefinitionSchema,
})
export type CreateBotFlowInput = z.infer<typeof CreateBotFlowInputSchema>

export const UpdateBotFlowInputSchema = CreateBotFlowInputSchema.partial()
export type UpdateBotFlowInput = z.infer<typeof UpdateBotFlowInputSchema>

export const BotFlowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  triggerType: BotTriggerTypeSchema,
  active: z.boolean(),
  flowDefinition: BotFlowDefinitionSchema,
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type BotFlow = z.infer<typeof BotFlowSchema>

// 9. BotSession Entity Schemas
export const BotSessionStatusSchema = z.enum(['active', 'paused', 'completed', 'handoff', 'failed'])
export type BotSessionStatus = z.infer<typeof BotSessionStatusSchema>

export const BotSessionSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  flowId: z.string().uuid(),
  currentNodeId: z.string().nullable().optional(),
  status: BotSessionStatusSchema,
  contextData: z.record(z.any()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type BotSession = z.infer<typeof BotSessionSchema>
