import {
  type BotEdge,
  type BotFlowDefinition,
  BotFlowDefinitionSchema,
  type BotNode,
  type BotNodeType,
  type BotTriggerType,
} from '@xatxoot/shared'
import { useState } from 'react'
import { Badge, Button } from '../astryx'

export interface ValidateFlowResult {
  isValid: boolean
  errors: string[]
}

export function validateFlowDefinition(flow: BotFlowDefinition): ValidateFlowResult {
  const errors: string[] = []

  if (!flow.nodes || flow.nodes.length === 0) {
    errors.push('Minimal satu node diperlukan dalam alur bot.')
    return { isValid: false, errors }
  }

  const nodeIds = new Set(flow.nodes.map((n) => n.id))

  if (!flow.startNodeId || !nodeIds.has(flow.startNodeId)) {
    errors.push(`Start node ID "${flow.startNodeId}" tidak ditemukan dalam daftar node alur.`)
  }

  const parsed = BotFlowDefinitionSchema.safeParse(flow)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function createDefaultNode(type: BotNodeType): BotNode {
  const id = `node-${type}-${Date.now().toString(36)}`
  switch (type) {
    case 'message':
      return {
        id,
        type: 'message',
        name: 'Pesan Teks',
        data: { text: 'Halo! Selamat datang di layanan asisten kami.' },
      }
    case 'question':
      return {
        id,
        type: 'question',
        name: 'Pertanyaan Pelanggan',
        data: {
          question: 'Silakan pilih opsi layanan Anda:',
          questionType: 'choice',
          variableName: 'pilihan_menu',
          options: [
            { id: 'opt-1', label: '1. Layanan Umum', value: 'umum' },
            { id: 'opt-2', label: '2. Bantuan Khusus', value: 'khusus' },
          ],
        },
      }
    case 'http':
      return {
        id,
        type: 'http',
        name: 'Panggilan API Webhook',
        data: {
          url: 'https://api.external.com/v1/lookup',
          method: 'POST',
          responseVariable: 'api_data',
        },
      }
    case 'branch':
      return {
        id,
        type: 'branch',
        name: 'Evaluasi Percabangan',
        data: {
          conditions: [
            {
              variable: 'pilihan_menu',
              operator: 'equals',
              value: 'khusus',
            },
          ],
        },
      }
    case 'handoff':
      return {
        id,
        type: 'handoff',
        name: 'Handoff ke Agen Manusia',
        data: {
          priority: 'medium',
          handoffMessage: 'Pelanggan dialihkan ke antrean agent CS manusia.',
        },
      }
  }
}

export interface VisualFlowBuilderProps {
  initialFlow: BotFlowDefinition
  flowName?: string
  triggerType?: BotTriggerType
  isActive?: boolean
  selectedNodeId?: string | null
  onSave?: (
    flow: BotFlowDefinition,
    metadata: { name: string; triggerType: BotTriggerType; active: boolean },
  ) => void
  onCancel?: () => void
}

export function VisualFlowBuilder({
  initialFlow,
  flowName = 'Alur Chatbot Otomatis',
  triggerType = 'conversation_opened',
  isActive = true,
  selectedNodeId: propSelectedNodeId = null,
  onSave,
  onCancel,
}: VisualFlowBuilderProps) {
  const [flow, setFlow] = useState<BotFlowDefinition>(initialFlow)
  const [name, setName] = useState(flowName)
  const [trigger, setTrigger] = useState<BotTriggerType>(triggerType)
  const [active, setActive] = useState(isActive)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    propSelectedNodeId || initialFlow.startNodeId || initialFlow.nodes[0]?.id || null,
  )
  const [validationResult, setValidationResult] = useState<ValidateFlowResult>(() =>
    validateFlowDefinition(initialFlow),
  )

  const selectedNode = flow.nodes.find((n) => n.id === selectedNodeId) || null

  const getNodeTypeBadge = (type: BotNodeType) => {
    switch (type) {
      case 'message':
        return (
          <Badge variant="success" size="sm">
            💬 Pesan
          </Badge>
        )
      case 'question':
        return (
          <Badge variant="ticket-pending" size="sm">
            ❓ Pertanyaan
          </Badge>
        )
      case 'http':
        return (
          <Badge variant="ticket-snoozed" size="sm">
            🌐 HTTP Request
          </Badge>
        )
      case 'branch':
        return (
          <Badge variant="warning" size="sm">
            🔀 Percabangan
          </Badge>
        )
      case 'handoff':
        return (
          <Badge variant="error" size="sm">
            👤 Handoff ke Agent
          </Badge>
        )
    }
  }

  const handleAddNode = (type: BotNodeType) => {
    const newNode = createDefaultNode(type)
    const updatedNodes = [...flow.nodes, newNode]
    const updatedFlow: BotFlowDefinition = {
      ...flow,
      nodes: updatedNodes,
      startNodeId: flow.startNodeId || newNode.id,
    }
    setFlow(updatedFlow)
    setSelectedNodeId(newNode.id)
    setValidationResult(validateFlowDefinition(updatedFlow))
  }

  const handleDeleteNode = (id: string) => {
    if (flow.nodes.length <= 1) {
      return
    }
    const updatedNodes = flow.nodes.filter((n) => n.id !== id)
    const updatedEdges = flow.edges.filter((e) => e.source !== id && e.target !== id)
    const newStartId = flow.startNodeId === id ? updatedNodes[0]?.id || '' : flow.startNodeId

    const updatedFlow: BotFlowDefinition = {
      ...flow,
      nodes: updatedNodes,
      edges: updatedEdges,
      startNodeId: newStartId,
    }
    setFlow(updatedFlow)
    if (selectedNodeId === id) {
      setSelectedNodeId(updatedNodes[0]?.id || null)
    }
    setValidationResult(validateFlowDefinition(updatedFlow))
  }

  const handleSetStartNode = (id: string) => {
    const updatedFlow: BotFlowDefinition = {
      ...flow,
      startNodeId: id,
    }
    setFlow(updatedFlow)
    setValidationResult(validateFlowDefinition(updatedFlow))
  }

  const handleUpdateNodeData = (nodeId: string, updatedFields: Partial<BotNode>) => {
    const updatedNodes = flow.nodes.map((n) => {
      if (n.id !== nodeId) return n
      return {
        ...n,
        ...updatedFields,
        data: {
          ...n.data,
          ...(updatedFields.data || {}),
        },
      } as BotNode
    })

    const updatedFlow: BotFlowDefinition = {
      ...flow,
      nodes: updatedNodes,
    }
    setFlow(updatedFlow)
    setValidationResult(validateFlowDefinition(updatedFlow))
  }

  const handleAddEdge = (source: string, target: string) => {
    if (!source || !target || source === target) return
    const edgeId = `edge-${source}-${target}`
    if (flow.edges.some((e) => e.id === edgeId || (e.source === source && e.target === target))) {
      return
    }
    const newEdge: BotEdge = {
      id: edgeId,
      source,
      target,
    }
    const updatedFlow: BotFlowDefinition = {
      ...flow,
      edges: [...flow.edges, newEdge],
    }
    setFlow(updatedFlow)
    setValidationResult(validateFlowDefinition(updatedFlow))
  }

  const handleDeleteEdge = (edgeId: string) => {
    const updatedFlow: BotFlowDefinition = {
      ...flow,
      edges: flow.edges.filter((e) => e.id !== edgeId),
    }
    setFlow(updatedFlow)
    setValidationResult(validateFlowDefinition(updatedFlow))
  }

  const handleSave = () => {
    const validation = validateFlowDefinition(flow)
    setValidationResult(validation)
    if (validation.isValid && onSave) {
      onSave(flow, { name, triggerType: trigger, active })
    }
  }

  return (
    <div
      data-testid="visual-flow-builder"
      className="flex flex-col h-full w-full bg-[#f0f2f5] select-none overflow-hidden font-sans"
    >
      {/* Top Header Bar */}
      <header className="h-16 bg-white px-6 flex items-center justify-between border-b border-[#e9edef] shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-bold text-base text-[#111b21] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-wa-teal-primary focus:outline-none px-1"
                placeholder="Nama Bot Flow..."
              />
              <div className="flex items-center gap-2 text-xs text-[#667781] px-1">
                <span>Trigger:</span>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as BotTriggerType)}
                  className="bg-transparent border-none text-emerald-800 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="conversation_opened">Saat Chat Baru Terbuka</option>
                  <option value="message_received">Saat Pesan Masuk</option>
                  <option value="manual">Manual Trigger</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="accent-wa-teal-primary w-4 h-4 rounded cursor-pointer"
            />
            <span>{active ? 'Status: Aktif' : 'Status: Non-aktif'}</span>
          </label>

          {onCancel && (
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Tutup
            </Button>
          )}

          <Button
            data-testid="btn-save-flow"
            variant="teal"
            size="sm"
            onClick={handleSave}
            disabled={!validationResult.isValid}
          >
            Simpan Alur
          </Button>
        </div>
      </header>

      {/* Main Flow Canvas Layout: Left Toolbar + Center Canvas + Right Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar Palette */}
        <aside
          data-testid="flow-toolbar"
          className="w-56 bg-white border-r border-[#e9edef] p-4 flex flex-col gap-3 shrink-0"
        >
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Tambah Node Alur
          </div>

          <button
            type="button"
            data-testid="btn-add-message"
            onClick={() => handleAddNode('message')}
            className="w-full px-3 py-2 text-left text-xs font-semibold bg-emerald-50 hover:bg-emerald-100/70 text-emerald-800 rounded-lg border border-emerald-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>💬</span>
            <span>+ Pesan Teks</span>
          </button>

          <button
            type="button"
            data-testid="btn-add-question"
            onClick={() => handleAddNode('question')}
            className="w-full px-3 py-2 text-left text-xs font-semibold bg-sky-50 hover:bg-sky-100/70 text-sky-800 rounded-lg border border-sky-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>❓</span>
            <span>+ Pertanyaan</span>
          </button>

          <button
            type="button"
            data-testid="btn-add-http"
            onClick={() => handleAddNode('http')}
            className="w-full px-3 py-2 text-left text-xs font-semibold bg-indigo-50 hover:bg-indigo-100/70 text-indigo-800 rounded-lg border border-indigo-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>🌐</span>
            <span>+ HTTP Request</span>
          </button>

          <button
            type="button"
            data-testid="btn-add-branch"
            onClick={() => handleAddNode('branch')}
            className="w-full px-3 py-2 text-left text-xs font-semibold bg-amber-50 hover:bg-amber-100/70 text-amber-800 rounded-lg border border-amber-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>🔀</span>
            <span>+ Percabangan</span>
          </button>

          <button
            type="button"
            data-testid="btn-add-handoff"
            onClick={() => handleAddNode('handoff')}
            className="w-full px-3 py-2 text-left text-xs font-semibold bg-rose-50 hover:bg-rose-100/70 text-rose-800 rounded-lg border border-rose-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>👤</span>
            <span>+ Handoff Agent</span>
          </button>

          {/* Validation Status Summary */}
          <div className="mt-auto pt-4 border-t border-slate-100 text-xs">
            <div className="font-semibold text-slate-700 mb-1">Status Validasi</div>
            {validationResult.isValid ? (
              <div className="text-emerald-700 flex items-center gap-1.5 font-medium">
                <span>✓</span>
                <span>Alur valid & siap aktif</span>
              </div>
            ) : (
              <div className="text-rose-600 font-medium">
                <span>⚠️ {validationResult.errors[0] || 'Alur belum valid'}</span>
              </div>
            )}
          </div>
        </aside>

        {/* Center Node Graph Canvas */}
        <main
          data-testid="flow-builder-canvas"
          className="flex-1 overflow-y-auto p-6 bg-[#efeae2] wa-doodle-pattern flex flex-col gap-4 relative"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
            {flow.nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.id
              const isStartNode = flow.startNodeId === node.id

              return (
                <div
                  key={node.id}
                  data-testid={`flow-node-${node.id}`}
                  className={`bg-white rounded-xl shadow-md border transition-all overflow-hidden flex flex-col ${
                    isSelected
                      ? 'border-wa-teal-primary ring-2 ring-wa-teal-primary/40'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header & Body Clickable Area */}
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className="w-full text-left p-0 flex flex-col flex-1 cursor-pointer focus:outline-none"
                  >
                    {/* Card Header */}
                    <div className="w-full px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-slate-400">#{index + 1}</span>
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {node.name || node.type}
                        </span>
                      </div>
                      {getNodeTypeBadge(node.type)}
                    </div>

                    {/* Card Body Preview */}
                    <div className="w-full p-3.5 text-xs text-slate-600 flex-1 space-y-2">
                      {node.type === 'message' && (
                        <p className="line-clamp-2 text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                          {node.data.text || 'Tanpa pesan'}
                        </p>
                      )}

                      {node.type === 'question' && (
                        <div className="space-y-1">
                          <p className="font-medium text-slate-700">{node.data.question}</p>
                          <div className="text-[11px] text-slate-400">
                            Variabel:{' '}
                            <code className="text-emerald-700 font-mono font-semibold">
                              {node.data.variableName}
                            </code>
                          </div>
                        </div>
                      )}

                      {node.type === 'http' && (
                        <div className="font-mono text-[11px] text-slate-600 truncate bg-slate-50 p-1.5 rounded">
                          <span className="font-bold text-indigo-700">{node.data.method}</span>{' '}
                          {node.data.url}
                        </div>
                      )}

                      {node.type === 'branch' && (
                        <div className="text-[11px] text-slate-500">
                          <span>{node.data.conditions.length} aturan percabangan</span>
                        </div>
                      )}

                      {node.type === 'handoff' && (
                        <div className="text-[11px] text-rose-700 font-medium">
                          Prioritas: {node.data.priority || 'medium'}
                        </div>
                      )}

                      {isStartNode && (
                        <span
                          data-testid="start-node-badge"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full"
                        >
                          🚩 Titik Awal
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Card Footer Actions */}
                  <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                    {!isStartNode ? (
                      <button
                        type="button"
                        data-testid={`btn-set-start-${node.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSetStartNode(node.id)
                        }}
                        className="text-slate-500 hover:text-emerald-700 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Set Titik Awal
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-bold">Node Pertama</span>
                    )}

                    {flow.nodes.length > 1 && (
                      <button
                        type="button"
                        data-testid={`btn-delete-node-${node.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteNode(node.id)
                        }}
                        className="text-slate-400 hover:text-rose-600 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick Connect Edge Panel at Bottom of Canvas */}
          <div
            data-testid="edge-list-panel"
            className="mt-auto bg-white/95 backdrop-blur-xs rounded-xl p-4 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">
                Koneksi Alur ({flow.edges.length} Sambungan)
              </span>
              <div className="flex items-center gap-2 text-xs">
                <select
                  id="connect-source"
                  className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                  defaultValue={flow.nodes[0]?.id}
                >
                  {flow.nodes.map((n) => (
                    <option key={`src-${n.id}`} value={n.id}>
                      Dari: {n.name || n.id}
                    </option>
                  ))}
                </select>
                <span className="text-slate-400">➔</span>
                <select
                  id="connect-target"
                  className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                  defaultValue={flow.nodes[1]?.id || flow.nodes[0]?.id}
                >
                  {flow.nodes.map((n) => (
                    <option key={`tgt-${n.id}`} value={n.id}>
                      Ke: {n.name || n.id}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const srcSelect = document.getElementById(
                      'connect-source',
                    ) as HTMLSelectElement | null
                    const tgtSelect = document.getElementById(
                      'connect-target',
                    ) as HTMLSelectElement | null
                    if (srcSelect && tgtSelect) {
                      handleAddEdge(srcSelect.value, tgtSelect.value)
                    }
                  }}
                >
                  Sambungkan
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {flow.edges.map((edge) => {
                const srcNode = flow.nodes.find((n) => n.id === edge.source)
                const tgtNode = flow.nodes.find((n) => n.id === edge.target)
                return (
                  <span
                    key={edge.id}
                    data-testid={`edge-item-${edge.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs border border-slate-200"
                  >
                    <span className="font-semibold">{srcNode?.name || edge.source}</span>
                    <span className="text-slate-400">➔</span>
                    <span className="font-semibold">{tgtNode?.name || edge.target}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteEdge(edge.id)}
                      className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                      title="Hapus sambungan"
                    >
                      &times;
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        </main>

        {/* Right Node Inspector Drawer */}
        <aside
          data-testid="node-inspector"
          className="w-80 bg-white border-l border-[#e9edef] p-5 flex flex-col gap-4 overflow-y-auto shrink-0"
        >
          <div className="border-b border-slate-200 pb-3">
            <h3 className="font-bold text-sm text-[#111b21]">Konfigurasi Node</h3>
            <p className="text-xs text-[#667781]">
              {selectedNode ? `Tipe: ${selectedNode.type.toUpperCase()}` : 'Pilih node pada canvas'}
            </p>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Node
                  <input
                    type="text"
                    value={selectedNode.name || ''}
                    onChange={(e) =>
                      handleUpdateNodeData(selectedNode.id, { name: e.target.value })
                    }
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-wa-teal-primary font-normal"
                  />
                </label>
              </div>

              {/* Message Node Form */}
              {selectedNode.type === 'message' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teks Pesan WhatsApp
                    <textarea
                      data-testid="inspector-message-text"
                      rows={4}
                      value={selectedNode.data.text}
                      onChange={(e) =>
                        handleUpdateNodeData(selectedNode.id, {
                          data: { ...selectedNode.data, text: e.target.value },
                        })
                      }
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-wa-teal-primary resize-none font-normal"
                      placeholder="Ketik balasan bot..."
                    />
                  </label>
                </div>
              )}

              {/* Question Node Form */}
              {selectedNode.type === 'question' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pertanyaan
                      <textarea
                        data-testid="inspector-question-text"
                        rows={3}
                        value={selectedNode.data.question}
                        onChange={(e) =>
                          handleUpdateNodeData(selectedNode.id, {
                            data: { ...selectedNode.data, question: e.target.value },
                          })
                        }
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-wa-teal-primary resize-none font-normal"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Simpan ke Variabel
                      <input
                        type="text"
                        value={selectedNode.data.variableName}
                        onChange={(e) =>
                          handleUpdateNodeData(selectedNode.id, {
                            data: { ...selectedNode.data, variableName: e.target.value },
                          })
                        }
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-wa-teal-primary font-normal"
                      />
                    </label>
                  </div>

                  {selectedNode.data.options && selectedNode.data.options.length > 0 && (
                    <div>
                      <div className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Pilihan Jawaban
                      </div>
                      <div className="space-y-1.5">
                        {selectedNode.data.options.map((opt) => (
                          <div
                            key={opt.id}
                            className="p-2 bg-slate-50 rounded border border-slate-200 text-xs flex justify-between"
                          >
                            <span className="font-medium text-slate-800">{opt.label}</span>
                            <code className="text-emerald-700 text-[11px]">{opt.value}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HTTP Node Form */}
              {selectedNode.type === 'http' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Method
                      <select
                        value={selectedNode.data.method}
                        onChange={(e) =>
                          handleUpdateNodeData(selectedNode.id, {
                            data: {
                              ...selectedNode.data,
                              method: e.target.value as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
                            },
                          })
                        }
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-indigo-700"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Endpoint URL
                      <input
                        type="text"
                        value={selectedNode.data.url}
                        onChange={(e) =>
                          handleUpdateNodeData(selectedNode.id, {
                            data: { ...selectedNode.data, url: e.target.value },
                          })
                        }
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-wa-teal-primary font-normal"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Variabel Penyimpan Respons
                      <input
                        type="text"
                        value={selectedNode.data.responseVariable}
                        onChange={(e) =>
                          handleUpdateNodeData(selectedNode.id, {
                            data: { ...selectedNode.data, responseVariable: e.target.value },
                          })
                        }
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-wa-teal-primary font-normal"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Handoff Node Form */}
              {selectedNode.type === 'handoff' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Prioritas Tiket
                      <select
                        value={selectedNode.data.priority || 'medium'}
                        onChange={(e) =>
                          handleUpdateNodeData(selectedNode.id, {
                            data: {
                              ...selectedNode.data,
                              priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent',
                            },
                          })
                        }
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs capitalize font-normal"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pesan Handoff
                      <textarea
                        rows={3}
                        value={selectedNode.data.handoffMessage || ''}
                        onChange={(e) =>
                          handleUpdateNodeData(selectedNode.id, {
                            data: { ...selectedNode.data, handoffMessage: e.target.value },
                          })
                        }
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-wa-teal-primary resize-none font-normal"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400 py-12">
              Klik salah satu kartu node di canvas untuk mengedit pengaturannya.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
