import { type ReactNode, useState } from 'react'

// ==========================================
// Types & Domain Interfaces
// (Single Organization: No tenant identifiers)
// ==========================================

export type AutomationEventName =
  | 'conversation_created'
  | 'conversation_updated'
  | 'conversation_opened'
  | 'conversation_resolved'
  | 'message_created'

export type ConditionOperator =
  | 'equal_to'
  | 'not_equal_to'
  | 'contains'
  | 'does_not_contain'
  | 'starts_with'
  | 'ends_with'
  | 'is_present'
  | 'is_not_present'
  | 'in_list'

export interface AutomationConditionItem {
  attribute: string
  operator: ConditionOperator
  value?: string | string[]
}

export type ActionTypeName =
  | 'assign_team'
  | 'assign_agent'
  | 'add_label'
  | 'remove_label'
  | 'change_status'
  | 'change_priority'
  | 'send_message'
  | 'mute_conversation'

export interface AutomationActionItem {
  actionName: ActionTypeName
  actionParams?: {
    teamId?: string
    agentId?: string
    labels?: string[]
    status?: 'open' | 'pending' | 'resolved' | 'snoozed'
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    message?: string
  }
}

export interface AutomationRuleFormData {
  id?: string
  name: string
  description?: string
  eventName: AutomationEventName
  conditions: AutomationConditionItem[]
  actions: AutomationActionItem[]
  active: boolean
}

export interface AutomationRuleBuilderProps {
  initialRule?: Partial<AutomationRuleFormData>
  onSave?: (rule: AutomationRuleFormData) => void
  onCancel?: () => void
  className?: string
  children?: ReactNode
}

// ==========================================
// Constants & Options
// ==========================================

export const EVENT_TRIGGER_OPTIONS: { value: AutomationEventName; label: string; desc: string }[] =
  [
    {
      value: 'message_created',
      label: 'Pesan Masuk / Dibuat',
      desc: 'Dipicu saat pesan baru diterima dari pelanggan atau dikirim',
    },
    {
      value: 'conversation_created',
      label: 'Percakapan Baru Dibuat',
      desc: 'Dipicu saat kontak baru pertama kali memulai percakapan',
    },
    {
      value: 'conversation_updated',
      label: 'Percakapan Diperbarui',
      desc: 'Dipicu saat metadata, penugasan, atau label percakapan berubah',
    },
    {
      value: 'conversation_opened',
      label: 'Tiket/Percakapan Dibuka Kembali',
      desc: 'Dipicu saat status tiket berpindah kembali ke Terbuka (Open)',
    },
    {
      value: 'conversation_resolved',
      label: 'Tiket/Percakapan Diselesaikan',
      desc: 'Dipicu saat tiket diubah menjadi Selesai (Resolved)',
    },
  ]

export const CONDITION_ATTRIBUTE_OPTIONS: { value: string; label: string }[] = [
  { value: 'content', label: 'Isi Pesan (Content)' },
  { value: 'inbox_id', label: 'Saluran / Inbox' },
  { value: 'labels', label: 'Label / Tag' },
  { value: 'status', label: 'Status Tiket' },
  { value: 'priority', label: 'Prioritas Tiket' },
  { value: 'assignee_id', label: 'Petugas CS (Assignee)' },
  { value: 'team_id', label: 'Tim Penanganan' },
]

export const CONDITION_OPERATOR_OPTIONS: { value: ConditionOperator; label: string }[] = [
  { value: 'contains', label: 'Mengandung teks (Contains)' },
  { value: 'does_not_contain', label: 'Tidak mengandung (Does not contain)' },
  { value: 'equal_to', label: 'Sama dengan (=)' },
  { value: 'not_equal_to', label: 'Tidak sama dengan (!=)' },
  { value: 'starts_with', label: 'Diawali dengan' },
  { value: 'ends_with', label: 'Diakhiri dengan' },
  { value: 'in_list', label: 'Termasuk dalam daftar' },
  { value: 'is_present', label: 'Ada / Terisi' },
  { value: 'is_not_present', label: 'Kosong / Belum ada' },
]

export const ACTION_TYPE_OPTIONS: { value: ActionTypeName; label: string; desc: string }[] = [
  {
    value: 'assign_team',
    label: 'Tugaskan ke Tim',
    desc: 'Alihkan percakapan ke grup/tim penanganan spesifik',
  },
  {
    value: 'assign_agent',
    label: 'Tugaskan ke Agen',
    desc: 'Alihkan percakapan ke petugas CS tertentu',
  },
  {
    value: 'add_label',
    label: 'Tambahkan Label',
    desc: 'Sematkan satu atau lebih tag kategori pada percakapan',
  },
  {
    value: 'remove_label',
    label: 'Hapus Label',
    desc: 'Lepaskan label dari percakapan pelanggan',
  },
  {
    value: 'change_status',
    label: 'Ubah Status Tiket',
    desc: 'Pindahkan status tiket (misal: pending, resolved)',
  },
  {
    value: 'change_priority',
    label: 'Ubah Prioritas',
    desc: 'Tingkatkan atau turunkan prioritas penanganan tiket',
  },
  {
    value: 'send_message',
    label: 'Kirim Pesan Otomatis',
    desc: 'Balas pesan otomatis ke kontak WhatsApp atau widget',
  },
  {
    value: 'mute_conversation',
    label: 'Senyapkan Percakapan',
    desc: 'Matikan notifikasi peringatan untuk obrolan ini',
  },
]

// ==========================================
// Validator Function
// ==========================================

export function validateAutomationRuleForm(data: AutomationRuleFormData): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!data.name || !data.name.trim()) {
    errors.push('Nama aturan wajib diisi')
  }

  if (!data.eventName) {
    errors.push('Pemicu event wajib dipilih')
  }

  if (!data.conditions || data.conditions.length === 0) {
    errors.push('Minimal satu filter kondisi wajib ditentukan')
  }

  if (!data.actions || data.actions.length === 0) {
    errors.push('Minimal satu aksi eksekusi wajib ditentukan')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// ==========================================
// Default Mock Data
// ==========================================

export const DEFAULT_AUTOMATION_RULE: AutomationRuleFormData = {
  name: 'Auto-Assign Tagihan & Invoice ke Tim Finance',
  description: 'Menetapkan percakapan yang menyebutkan tagihan langsung ke tim finance',
  eventName: 'message_created',
  conditions: [
    {
      attribute: 'content',
      operator: 'contains',
      value: 'Invoice',
    },
  ],
  actions: [
    {
      actionName: 'assign_team',
      actionParams: { teamId: 'team-finance' },
    },
    {
      actionName: 'add_label',
      actionParams: { labels: ['billing', 'invoice'] },
    },
  ],
  active: true,
}

// ==========================================
// Main AutomationRuleBuilder Component
// ==========================================

export function AutomationRuleBuilder({
  initialRule = DEFAULT_AUTOMATION_RULE,
  onSave = () => {},
  onCancel = () => {},
  className = '',
  children,
}: AutomationRuleBuilderProps) {
  const [name, setName] = useState(initialRule.name || '')
  const [description, setDescription] = useState(initialRule.description || '')
  const [eventName, setEventName] = useState<AutomationEventName>(
    initialRule.eventName || 'message_created',
  )
  const [conditions, setConditions] = useState<AutomationConditionItem[]>(
    initialRule.conditions && initialRule.conditions.length > 0
      ? initialRule.conditions
      : [{ attribute: 'content', operator: 'contains', value: '' }],
  )
  const [actions, setActions] = useState<AutomationActionItem[]>(
    initialRule.actions && initialRule.actions.length > 0
      ? initialRule.actions
      : [{ actionName: 'assign_team', actionParams: { teamId: '' } }],
  )
  const [active, setActive] = useState(initialRule.active !== undefined ? initialRule.active : true)
  const [formError, setFormError] = useState<string | null>(null)

  // Condition Handlers
  const handleAddCondition = () => {
    setConditions((prev) => [...prev, { attribute: 'content', operator: 'contains', value: '' }])
  }

  const handleRemoveCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleConditionChange = (
    index: number,
    field: keyof AutomationConditionItem,
    val: unknown,
  ) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: val } : c)))
  }

  // Action Handlers
  const handleAddAction = () => {
    setActions((prev) => [...prev, { actionName: 'add_label', actionParams: { labels: [] } }])
  }

  const handleRemoveAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleActionTypeChange = (index: number, newType: ActionTypeName) => {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { actionName: newType, actionParams: {} } : a)),
    )
  }

  const handleActionParamChange = (index: number, paramKey: string, val: unknown) => {
    setActions((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, actionParams: { ...(a.actionParams || {}), [paramKey]: val } } : a,
      ),
    )
  }

  const handleSubmit = () => {
    const formData: AutomationRuleFormData = {
      id: initialRule.id,
      name,
      description,
      eventName,
      conditions,
      actions,
      active,
    }

    const validation = validateAutomationRuleForm(formData)
    if (!validation.isValid) {
      setFormError(validation.errors[0])
      return
    }

    setFormError(null)
    onSave(formData)
  }

  return (
    <div
      data-testid="automation-rule-builder"
      className={`min-h-full w-full bg-wa-header-bg p-4 sm:p-6 lg:p-8 flex flex-col space-y-6 ${className}`}
    >
      {/* Top Header Card */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h1 className="text-xl sm:text-2xl font-bold text-wa-text-primary tracking-tight">
              Builder Automation Rules
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Rancang alur otomatisasi berbasis logika visual:{' '}
            <span className="font-semibold text-gray-700">Trigger → Filter → Action</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            data-testid="btn-cancel-rule"
            onClick={onCancel}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3.5 py-2 rounded-lg border border-gray-200 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            data-testid="btn-save-rule"
            onClick={handleSubmit}
            className="text-xs font-semibold text-white bg-wa-teal-primary hover:bg-wa-teal-hover px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>💾</span>
            <span>Simpan Aturan</span>
          </button>
        </div>
      </div>

      {formError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <span>⚠️</span>
          <span>{formError}</span>
        </div>
      )}

      {/* Metadata Form: Name, Description, Active Toggle */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div>
            <label
              htmlFor="rule-name-input"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Nama Aturan Otomasi
            </label>
            <input
              id="rule-name-input"
              type="text"
              data-testid="rule-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Auto-Assign Tagihan & Invoice ke Tim Finance"
              className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent text-gray-800"
            />
          </div>

          <div>
            <label
              htmlFor="rule-description-input"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Deskripsi (Opsional)
            </label>
            <input
              id="rule-description-input"
              type="text"
              data-testid="rule-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan tujuan atau kondisi spesifik aturan ini..."
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent text-gray-600"
            />
          </div>
        </div>

        {/* Status Toggle Card */}
        <div className="flex flex-col justify-center items-start md:items-end p-4 bg-gray-50/70 rounded-xl border border-gray-100">
          <span className="text-xs font-semibold text-gray-700 mb-2">Status Operasional</span>
          <label className="inline-flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              data-testid="rule-active-toggle"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-teal-primary relative" />
            <span className="text-xs font-medium text-gray-700">
              {active ? 'Aturan Aktif' : 'Aturan Nonaktif'}
            </span>
          </label>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Visual Flow Pipeline: TRIGGER -> FILTER -> ACTION */}
      {/* ======================================================== */}
      <div className="space-y-4">
        {/* Step 1: TRIGGER */}
        <div
          data-testid="section-trigger"
          className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden"
        >
          <div className="bg-amber-50/80 px-5 py-3.5 border-b border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base p-1 bg-amber-100 text-amber-800 rounded-lg">⚡</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">1. TRIGGER (Pemicu Event)</h3>
                <p className="text-[11px] text-gray-500">
                  Kapan sistem harus mulai mengevaluasi aturan otomasi ini?
                </p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-amber-200/60 text-amber-900 rounded">
              Langkah 1
            </span>
          </div>

          <div className="p-5">
            <label
              htmlFor="trigger-event-select"
              className="block text-xs font-semibold text-gray-700 mb-1.5"
            >
              Pilih Event Pemicu
            </label>
            <select
              id="trigger-event-select"
              data-testid="trigger-event-select"
              value={eventName}
              onChange={(e) => setEventName(e.target.value as AutomationEventName)}
              className="w-full text-xs font-medium border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent text-gray-800 cursor-pointer bg-white"
            >
              {EVENT_TRIGGER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Visual Flow Connector */}
        <div className="flex justify-center items-center py-0.5">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-200/80 text-gray-600 rounded-full text-[11px] font-semibold">
            <span>↓</span>
            <span>JIKA MEMENUHI SEMUA KONDISI (AND)</span>
            <span>↓</span>
          </div>
        </div>

        {/* Step 2: FILTER (CONDITIONS) */}
        <div
          data-testid="section-filter"
          className="bg-white rounded-xl shadow-sm border border-sky-200 overflow-hidden"
        >
          <div className="bg-sky-50/80 px-5 py-3.5 border-b border-sky-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base p-1 bg-sky-100 text-sky-800 rounded-lg">🔍</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">2. FILTER (Kondisi Pemeriksaan)</h3>
                <p className="text-[11px] text-gray-500">
                  Kriteria yang harus dipenuhi oleh pesan atau percakapan pelanggan
                </p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-sky-200/60 text-sky-900 rounded">
              Langkah 2
            </span>
          </div>

          <div className="p-5 space-y-3">
            {conditions.map((condition, index) => {
              const showValueInput =
                condition.operator !== 'is_present' && condition.operator !== 'is_not_present'

              return (
                <div
                  key={`cond-${index}-${condition.attribute}`}
                  data-testid={`condition-row-${index}`}
                  className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <span className="text-xs font-bold text-gray-400 w-6">#{index + 1}</span>

                  {/* Attribute Select */}
                  <select
                    value={condition.attribute}
                    onChange={(e) => handleConditionChange(index, 'attribute', e.target.value)}
                    className="w-full sm:w-1/3 text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-700 cursor-pointer"
                  >
                    {CONDITION_ATTRIBUTE_OPTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>

                  {/* Operator Select */}
                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      handleConditionChange(index, 'operator', e.target.value as ConditionOperator)
                    }
                    className="w-full sm:w-1/3 text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-700 cursor-pointer"
                  >
                    {CONDITION_OPERATOR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {/* Value Input */}
                  {showValueInput && (
                    <input
                      type="text"
                      value={typeof condition.value === 'string' ? condition.value : ''}
                      onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                      placeholder="Nilai kriteria..."
                      className="w-full sm:w-1/3 text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-800"
                    />
                  )}

                  {/* Delete Condition Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(index)}
                    title="Hapus Kondisi"
                    className="text-gray-400 hover:text-rose-600 p-1.5 transition-colors cursor-pointer ml-auto"
                  >
                    ✕
                  </button>
                </div>
              )
            })}

            <button
              type="button"
              data-testid="btn-add-condition"
              onClick={handleAddCondition}
              className="mt-2 text-xs font-semibold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>+</span>
              <span>Tambah Kondisi</span>
            </button>
          </div>
        </div>

        {/* Visual Flow Connector */}
        <div className="flex justify-center items-center py-0.5">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-200/80 text-gray-600 rounded-full text-[11px] font-semibold">
            <span>↓</span>
            <span>MAKA EKSEKUSI SEMUA TINDAKAN BERIKUT</span>
            <span>↓</span>
          </div>
        </div>

        {/* Step 3: ACTION (CHAINED ACTIONS) */}
        <div
          data-testid="section-action"
          className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden"
        >
          <div className="bg-emerald-50/80 px-5 py-3.5 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base p-1 bg-emerald-100 text-emerald-800 rounded-lg">🚀</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">3. ACTION (Eksekusi Berantai)</h3>
                <p className="text-[11px] text-gray-500">
                  Tindakan berurutan yang akan langsung dijalankan secara otomatis
                </p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-200/60 text-emerald-900 rounded">
              Langkah 3
            </span>
          </div>

          <div className="p-5 space-y-3">
            {actions.map((action, index) => (
              <div
                key={`act-${index}-${action.actionName}`}
                data-testid={`action-row-${index}`}
                className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <span className="text-xs font-bold text-gray-400 w-6">#{index + 1}</span>

                {/* Action Type Select */}
                <select
                  value={action.actionName}
                  onChange={(e) => handleActionTypeChange(index, e.target.value as ActionTypeName)}
                  className="w-full sm:w-1/3 text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-700 cursor-pointer"
                >
                  {ACTION_TYPE_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>

                {/* Parameter inputs based on actionName */}
                <div className="w-full sm:flex-1">
                  {action.actionName === 'assign_team' && (
                    <input
                      type="text"
                      value={action.actionParams?.teamId || ''}
                      onChange={(e) => handleActionParamChange(index, 'teamId', e.target.value)}
                      placeholder="ID Tim (misal: team-finance)..."
                      className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-800"
                    />
                  )}
                  {action.actionName === 'assign_agent' && (
                    <input
                      type="text"
                      value={action.actionParams?.agentId || ''}
                      onChange={(e) => handleActionParamChange(index, 'agentId', e.target.value)}
                      placeholder="ID Agen CS (misal: usr_sarah)..."
                      className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-800"
                    />
                  )}
                  {(action.actionName === 'add_label' || action.actionName === 'remove_label') && (
                    <input
                      type="text"
                      value={(action.actionParams?.labels || []).join(', ')}
                      onChange={(e) =>
                        handleActionParamChange(
                          index,
                          'labels',
                          e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="Label dipisah koma (misal: billing, invoice)..."
                      className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-800"
                    />
                  )}
                  {action.actionName === 'change_status' && (
                    <select
                      value={action.actionParams?.status || 'pending'}
                      onChange={(e) => handleActionParamChange(index, 'status', e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-700 cursor-pointer"
                    >
                      <option value="open">Open (Buka)</option>
                      <option value="pending">Pending (Menunggu)</option>
                      <option value="snoozed">Snoozed (Tunda)</option>
                      <option value="resolved">Resolved (Selesai)</option>
                    </select>
                  )}
                  {action.actionName === 'change_priority' && (
                    <select
                      value={action.actionParams?.priority || 'high'}
                      onChange={(e) => handleActionParamChange(index, 'priority', e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-700 cursor-pointer"
                    >
                      <option value="low">Low (Rendah)</option>
                      <option value="medium">Medium (Sedang)</option>
                      <option value="high">High (Tinggi)</option>
                      <option value="urgent">Urgent (Darurat)</option>
                    </select>
                  )}
                  {action.actionName === 'send_message' && (
                    <input
                      type="text"
                      value={action.actionParams?.message || ''}
                      onChange={(e) => handleActionParamChange(index, 'message', e.target.value)}
                      placeholder="Ketik teks pesan balasan otomatis..."
                      className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-800"
                    />
                  )}
                  {action.actionName === 'mute_conversation' && (
                    <span className="text-xs text-gray-500 italic">
                      Percakapan akan otomatis disenyapkan
                    </span>
                  )}
                </div>

                {/* Delete Action Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveAction(index)}
                  title="Hapus Aksi"
                  className="text-gray-400 hover:text-rose-600 p-1.5 transition-colors cursor-pointer ml-auto"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              data-testid="btn-add-action"
              onClick={handleAddAction}
              className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>+</span>
              <span>Tambah Aksi</span>
            </button>
          </div>
        </div>
      </div>

      {children}
    </div>
  )
}

export default AutomationRuleBuilder
