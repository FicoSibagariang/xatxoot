import type {
  SendWhatsAppTemplateMessageInput,
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
  WhatsAppTemplateComponent,
  WhatsAppTemplateMessageComponent,
  WhatsAppTemplateParameter,
} from '@xatxoot/shared'
import type React from 'react'
import { useMemo, useState } from 'react'
import { Badge, Button } from '../astryx'

export interface TemplateVariableValues {
  headerVars?: Record<number, string>
  bodyVars?: Record<number, string>
  headerMediaUrl?: string
}

export interface WhatsAppTemplateDialogProps {
  isOpen: boolean
  conversationId: string
  templates: WhatsAppTemplate[]
  selectedTemplateId?: string
  initialValues?: TemplateVariableValues
  onClose: () => void
  onSendTemplate: (payload: SendWhatsAppTemplateMessageInput) => void
}

/**
 * Ekstraksi indeks variabel numerik dari teks komponen template WhatsApp (misal: {{1}}, {{2}}).
 */
export function extractTemplateVariables(component?: WhatsAppTemplateComponent): number[] {
  if (!component || !component.text) return []
  const matches = component.text.matchAll(/\{\{(\d+)\}\}/g)
  const indices = new Set<number>()
  for (const match of matches) {
    if (match[1]) {
      indices.add(Number.parseInt(match[1], 10))
    }
  }
  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Ganti token {{1}}, {{2}}, dsb. dengan nilai yang diisi oleh pengguna untuk keperluan live preview.
 */
export function replaceTemplateVariables(
  text: string,
  values: Record<number, string> = {},
): string {
  if (!text) return ''
  return text.replace(/\{\{(\d+)\}\}/g, (match, p1) => {
    const idx = Number.parseInt(p1, 10)
    const val = values[idx]
    return val !== undefined && val.trim() !== '' ? val : match
  })
}

/**
 * Membangun payload SendWhatsAppTemplateMessageInput sesuai standar Meta Graph API / Xatxoot backend.
 */
export function buildSendTemplatePayload(
  template: WhatsAppTemplate,
  conversationId: string,
  values: TemplateVariableValues,
): SendWhatsAppTemplateMessageInput {
  const components: WhatsAppTemplateMessageComponent[] = []

  const headerComponent = template.components.find((c) => c.type === 'HEADER')
  if (headerComponent) {
    if (headerComponent.format === 'TEXT' || (!headerComponent.format && headerComponent.text)) {
      const headerVarIndices = extractTemplateVariables(headerComponent)
      if (headerVarIndices.length > 0) {
        const headerParams: WhatsAppTemplateParameter[] = headerVarIndices.map((idx) => ({
          type: 'text',
          text: values.headerVars?.[idx] || '',
        }))
        components.push({
          type: 'header',
          parameters: headerParams,
        })
      }
    } else if (
      headerComponent.format === 'IMAGE' ||
      headerComponent.format === 'DOCUMENT' ||
      headerComponent.format === 'VIDEO'
    ) {
      if (values.headerMediaUrl) {
        const mediaType = headerComponent.format.toLowerCase() as 'image' | 'document' | 'video'
        const param: WhatsAppTemplateParameter = {
          type: mediaType,
          [mediaType]: {
            link: values.headerMediaUrl,
          },
        }
        components.push({
          type: 'header',
          parameters: [param],
        })
      }
    }
  }

  const bodyComponent = template.components.find((c) => c.type === 'BODY')
  if (bodyComponent) {
    const bodyVarIndices = extractTemplateVariables(bodyComponent)
    if (bodyVarIndices.length > 0) {
      const bodyParams: WhatsAppTemplateParameter[] = bodyVarIndices.map((idx) => ({
        type: 'text',
        text: values.bodyVars?.[idx] || '',
      }))
      components.push({
        type: 'body',
        parameters: bodyParams,
      })
    }
  }

  return {
    conversationId,
    templateName: template.name,
    languageCode: template.language || 'id',
    components,
  }
}

export function WhatsAppTemplateDialog({
  isOpen,
  conversationId,
  templates,
  selectedTemplateId,
  initialValues,
  onClose,
  onSendTemplate,
}: WhatsAppTemplateDialogProps) {
  if (!isOpen) return null

  const approvedTemplates = useMemo(
    () => templates.filter((t) => !t.status || t.status === 'APPROVED'),
    [templates],
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | WhatsAppTemplateCategory>('ALL')
  const [activeId, setActiveId] = useState<string>(
    selectedTemplateId || (approvedTemplates.length > 0 ? approvedTemplates[0].id : ''),
  )

  const [formValues, setFormValues] = useState<TemplateVariableValues>(() => ({
    headerVars: initialValues?.headerVars ? { ...initialValues.headerVars } : {},
    bodyVars: initialValues?.bodyVars ? { ...initialValues.bodyVars } : {},
    headerMediaUrl: initialValues?.headerMediaUrl || '',
  }))

  const [validationError, setValidationError] = useState<string | null>(null)

  const filteredTemplates = useMemo(() => {
    return approvedTemplates.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.components.some((c) => c.text?.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [approvedTemplates, searchQuery, categoryFilter])

  const currentTemplate = useMemo(() => {
    return (
      approvedTemplates.find((t) => t.id === activeId) ||
      (filteredTemplates.length > 0 ? filteredTemplates[0] : null)
    )
  }, [approvedTemplates, filteredTemplates, activeId])

  const headerComponent = currentTemplate?.components.find((c) => c.type === 'HEADER')
  const bodyComponent = currentTemplate?.components.find((c) => c.type === 'BODY')
  const footerComponent = currentTemplate?.components.find((c) => c.type === 'FOOTER')
  const buttonsComponent = currentTemplate?.components.find((c) => c.type === 'BUTTONS')

  const headerVars = useMemo(
    () =>
      headerComponent?.format === 'TEXT' || (!headerComponent?.format && headerComponent?.text)
        ? extractTemplateVariables(headerComponent)
        : [],
    [headerComponent],
  )

  const isHeaderMedia =
    headerComponent &&
    (headerComponent.format === 'IMAGE' ||
      headerComponent.format === 'DOCUMENT' ||
      headerComponent.format === 'VIDEO')

  const bodyVars = useMemo(() => extractTemplateVariables(bodyComponent), [bodyComponent])

  const handleHeaderVarChange = (idx: number, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      headerVars: {
        ...prev.headerVars,
        [idx]: value,
      },
    }))
    setValidationError(null)
  }

  const handleBodyVarChange = (idx: number, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      bodyVars: {
        ...prev.bodyVars,
        [idx]: value,
      },
    }))
    setValidationError(null)
  }

  const handleHeaderMediaUrlChange = (value: string) => {
    setFormValues((prev) => ({
      ...prev,
      headerMediaUrl: value,
    }))
    setValidationError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentTemplate) return

    // Validasi kelengkapan variabel
    if (isHeaderMedia && !formValues.headerMediaUrl?.trim()) {
      setValidationError('URL Media Header wajib diisi untuk template ini.')
      return
    }

    for (const idx of headerVars) {
      if (!formValues.headerVars?.[idx]?.trim()) {
        setValidationError(`Variabel Header {{${idx}}} wajib diisi.`)
        return
      }
    }

    for (const idx of bodyVars) {
      if (!formValues.bodyVars?.[idx]?.trim()) {
        setValidationError(`Variabel Body {{${idx}}} wajib diisi.`)
        return
      }
    }

    const payload = buildSendTemplatePayload(currentTemplate, conversationId, formValues)
    onSendTemplate(payload)
    onClose()
  }

  return (
    <div
      data-testid="whatsapp-template-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 sm:p-6"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[90vh] max-h-[750px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <header className="px-6 py-4 bg-wa-header-bg border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-wa-teal-primary flex items-center justify-center font-bold text-lg">
              💬
            </div>
            <div>
              <h3 className="text-base font-bold text-wa-text-primary">
                Kirim Template WhatsApp Resmi
              </h3>
              <p className="text-xs text-wa-text-secondary">
                Pilih template pesan resmi yang telah disetujui Meta dan isi variabel dinamis.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="btn-close-template-dialog"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            ✕
          </button>
        </header>

        {/* Modal Body: 2 Kolom (Daftar Template & Isian Variabel/Preview) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Kolom Kiri: Pemilih Template & Filter */}
          <div className="w-full md:w-80 flex flex-col bg-wa-card-highlight shrink-0 overflow-hidden">
            {/* Search Bar & Filter */}
            <div className="p-3 border-b border-slate-200 flex flex-col gap-2">
              <input
                type="text"
                data-testid="input-template-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama template..."
                className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:border-wa-teal-primary text-wa-text-primary"
              />

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  data-testid="filter-template-category"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                    categoryFilter === 'ALL'
                      ? 'bg-wa-teal-primary text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('UTILITY')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                    categoryFilter === 'UTILITY'
                      ? 'bg-wa-teal-primary text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Utility
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('MARKETING')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                    categoryFilter === 'MARKETING'
                      ? 'bg-wa-teal-primary text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Marketing
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('AUTHENTICATION')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                    categoryFilter === 'AUTHENTICATION'
                      ? 'bg-wa-teal-primary text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Auth
                </button>
              </div>
            </div>

            {/* Template Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredTemplates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Tidak ada template yang cocok.
                </div>
              ) : (
                filteredTemplates.map((template) => {
                  const isSelected = currentTemplate?.id === template.id
                  const bodyText = template.components.find((c) => c.type === 'BODY')?.text || ''

                  return (
                    <button
                      type="button"
                      key={template.id}
                      data-testid={`template-item-${template.id}`}
                      onClick={() => {
                        setActiveId(template.id)
                        setValidationError(null)
                      }}
                      className={`w-full p-3.5 text-left transition-colors flex flex-col gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/70 border-l-4 border-wa-teal-primary'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-wa-text-primary truncate">
                          {template.name}
                        </span>
                        <Badge
                          variant={template.category === 'MARKETING' ? 'primary' : 'teal'}
                          size="sm"
                        >
                          {template.category}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-wa-text-secondary line-clamp-2 leading-relaxed">
                        {bodyText}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>Bahasa: {template.language}</span>
                        <span className="text-emerald-600 font-medium">✓ APPROVED</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Kolom Kanan: Dynamic Variable Input Form & Live Preview */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {currentTemplate ? (
              <form
                onSubmit={handleSubmit}
                data-testid="template-variables-form"
                className="flex-1 flex flex-col overflow-hidden"
              >
                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Dynamic Variables Section */}
                  <div>
                    <h4 className="text-sm font-bold text-wa-text-primary mb-1 flex items-center gap-1.5">
                      <span>✏️</span> Parameter & Variabel Dinamis
                    </h4>
                    <p className="text-xs text-wa-text-secondary mb-4">
                      Isi variabel dengan data pelanggan atau pesanan. Teks akan diperbarui di
                      pratinjau secara langsung.
                    </p>

                    {/* Media Header Input */}
                    {isHeaderMedia && (
                      <div className="mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <label
                          htmlFor="input-header-media"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          URL Header Media ({headerComponent?.format}) *
                        </label>
                        <input
                          id="input-header-media"
                          type="url"
                          data-testid="input-var-header-media"
                          required
                          value={formValues.headerMediaUrl || ''}
                          onChange={(e) => handleHeaderMediaUrlChange(e.target.value)}
                          placeholder={`https://domain.com/file.${headerComponent?.format?.toLowerCase() === 'image' ? 'jpg' : 'pdf'}`}
                          className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:border-wa-teal-primary text-wa-text-primary"
                        />
                      </div>
                    )}

                    {/* Header Text Variables */}
                    {headerVars.length > 0 && (
                      <div className="mb-4 space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <h5 className="text-xs font-semibold text-slate-700">
                          Variabel Header Teks:
                        </h5>
                        {headerVars.map((varNum) => (
                          <div key={`header-${varNum}`}>
                            <label
                              htmlFor={`input-var-header-${varNum}`}
                              className="block text-[11px] font-medium text-slate-600 mb-1"
                            >
                              Variabel Header {`{{${varNum}}}`} *
                            </label>
                            <input
                              id={`input-var-header-${varNum}`}
                              type="text"
                              data-testid={`input-var-header-${varNum}`}
                              required
                              value={formValues.headerVars?.[varNum] || ''}
                              onChange={(e) => handleHeaderVarChange(varNum, e.target.value)}
                              placeholder={`Nilai untuk {{${varNum}}} di Header`}
                              className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:border-wa-teal-primary text-wa-text-primary"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Body Text Variables */}
                    {bodyVars.length > 0 && (
                      <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <h5 className="text-xs font-semibold text-slate-700">
                          Variabel Isi Pesan (Body):
                        </h5>
                        {bodyVars.map((varNum) => (
                          <div key={`body-${varNum}`}>
                            <label
                              htmlFor={`input-var-body-${varNum}`}
                              className="block text-[11px] font-medium text-slate-600 mb-1"
                            >
                              Variabel Body {`{{${varNum}}}`} *
                            </label>
                            <input
                              id={`input-var-body-${varNum}`}
                              type="text"
                              data-testid={`input-var-body-${varNum}`}
                              required
                              value={formValues.bodyVars?.[varNum] || ''}
                              onChange={(e) => handleBodyVarChange(varNum, e.target.value)}
                              placeholder={`Nilai untuk {{${varNum}}} di Body`}
                              className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:border-wa-teal-primary text-wa-text-primary"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No Variables Needed Message */}
                    {!isHeaderMedia && headerVars.length === 0 && bodyVars.length === 0 && (
                      <div className="bg-emerald-50 text-emerald-800 text-xs p-3.5 rounded-xl border border-emerald-200">
                        Template ini bersifat statis dan tidak memerlukan parameter variabel
                        dinamis.
                      </div>
                    )}

                    {validationError && (
                      <p className="mt-3 text-xs font-medium text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                        ⚠️ {validationError}
                      </p>
                    )}
                  </div>

                  {/* Live WhatsApp Preview Section */}
                  <div>
                    <h4 className="text-sm font-bold text-wa-text-primary mb-2 flex items-center gap-1.5">
                      <span>📱</span> Pratinjau Pesan WhatsApp (Live Preview)
                    </h4>

                    <div
                      data-testid="template-live-preview"
                      className="bg-wa-chat-bg p-4 rounded-xl wa-doodle-pattern border border-slate-300"
                    >
                      {/* WhatsApp Chat Bubble */}
                      <div className="bg-white rounded-lg shadow-sm max-w-md p-3 text-xs text-wa-text-primary space-y-2 border border-slate-200/80">
                        {/* Header Preview */}
                        {headerComponent && (
                          <div
                            data-testid="preview-header"
                            className="font-bold text-sm text-wa-text-primary pb-1 border-b border-slate-100"
                          >
                            {isHeaderMedia ? (
                              <div className="bg-slate-100 rounded p-2 text-center text-xs text-slate-500 font-normal">
                                🖼️ [{headerComponent.format} Attachment:{' '}
                                {formValues.headerMediaUrl || 'Belum diisi'}]
                              </div>
                            ) : (
                              replaceTemplateVariables(
                                headerComponent.text || '',
                                formValues.headerVars,
                              )
                            )}
                          </div>
                        )}

                        {/* Body Preview */}
                        {bodyComponent && (
                          <div
                            data-testid="preview-body"
                            className="whitespace-pre-wrap leading-relaxed text-wa-text-primary"
                          >
                            {replaceTemplateVariables(
                              bodyComponent.text || '',
                              formValues.bodyVars,
                            )}
                          </div>
                        )}

                        {/* Footer Preview */}
                        {footerComponent?.text && (
                          <div
                            data-testid="preview-footer"
                            className="text-[10px] text-wa-text-secondary pt-1"
                          >
                            {footerComponent.text}
                          </div>
                        )}

                        {/* Buttons Preview */}
                        {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
                          <div
                            data-testid="preview-buttons"
                            className="pt-2 border-t border-slate-100 space-y-1.5"
                          >
                            {buttonsComponent.buttons.map((btn) => (
                              <div
                                key={btn.text}
                                className="w-full text-center py-1.5 text-xs font-semibold text-wa-teal-primary bg-slate-50 hover:bg-slate-100 rounded border border-slate-200"
                              >
                                {btn.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Modal Actions */}
                <footer className="px-6 py-4 bg-wa-header-bg border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={onClose}
                    className="cursor-pointer"
                  >
                    Batal
                  </Button>

                  <Button
                    type="submit"
                    variant="teal"
                    size="sm"
                    data-testid="btn-send-template"
                    className="cursor-pointer shadow-sm"
                  >
                    Kirim Template WhatsApp
                  </Button>
                </footer>
              </form>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-sm">
                Pilih salah satu template di sebelah kiri untuk mengisi variabel.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
