import { type ReactNode, useMemo, useState } from 'react'

// ==========================================
// Types & Domain Interfaces
// (Single Organization: No tenant identifiers)
// ==========================================

export type ArticleStatus = 'draft' | 'published' | 'archived'

export interface HelpCenterCategoryOption {
  id: string
  name: string
  slug: string
}

export interface HelpCenterArticleFormData {
  id?: string
  categoryId: string
  title: string
  slug: string
  contentMarkdown: string
  status: ArticleStatus
  authorName?: string
  viewsCount?: number
  createdAt?: string
  updatedAt?: string
}

export type EditorViewMode = 'split' | 'edit' | 'preview'

export interface HelpCenterEditorProps {
  initialData?: Partial<HelpCenterArticleFormData>
  categories?: HelpCenterCategoryOption[]
  onSave?: (data: HelpCenterArticleFormData) => void
  onPublish?: (data: HelpCenterArticleFormData) => void
  onCancel?: () => void
  className?: string
  children?: ReactNode
}

// ==========================================
// Slug & Reading Time Helpers
// ==========================================

export function generateSlugFromTitle(title: string): string {
  if (!title) return ''
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, ' ') // Ganti karakter non-alphanumeric selain spasi dan minus dengan spasi
    .replace(/\s+/g, '-') // Ganti satu atau lebih spasi dengan minus
    .replace(/-+/g, '-') // Ganti minus berulang dengan satu minus
    .replace(/^-+|-+$/g, '') // Hapus minus di awal dan akhir
}

export function calculateReadingTimeMinutes(markdown: string): number {
  if (!markdown || !markdown.trim()) return 1
  const words = markdown.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

// ==========================================
// Lightweight Safe Markdown Renderer
// ==========================================

export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''

  // 1. Ekstrak & lindungi block code
  const codeBlocks: string[] = []
  let text = markdown.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const index = codeBlocks.length
    const langClass = lang ? ` class="language-${lang}"` : ''
    codeBlocks.push(`<pre><code${langClass}>${escapedCode}</code></pre>`)
    return `__CODE_BLOCK_${index}__`
  })

  // 2. Escape HTML tag yang tidak sah di luar code
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // 3. Headings
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>')
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>')
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>')

  // 4. Blockquotes
  text = text.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>')

  // 5. Text styling (bold, italic, strikethrough, inline code)
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>')
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>')
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 6. Links: [text](url)
  text = text.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-wa-teal-primary underline hover:text-emerald-700">$1</a>',
  )

  // 7. Unordered lists: - item
  text = text.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')

  // 8. Ordered lists: 1. item
  text = text.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')

  // 9. Paragraf & baris baru
  const lines = text.split('\n\n')
  const formatted = lines
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (
        trimmed.startsWith('<h1>') ||
        trimmed.startsWith('<h2>') ||
        trimmed.startsWith('<h3>') ||
        trimmed.startsWith('<blockquote>') ||
        trimmed.startsWith('<li>') ||
        trimmed.startsWith('__CODE_BLOCK_')
      ) {
        return trimmed
      }
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')

  // 10. Pulihkan code blocks
  return formatted.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => {
    return codeBlocks[Number(idx)] || ''
  })
}

// ==========================================
// Default Mock Data
// ==========================================

export const DEFAULT_HELP_CATEGORIES: HelpCenterCategoryOption[] = [
  { id: 'cat-1', name: 'Panduan Memulai', slug: 'panduan-memulai' },
  { id: 'cat-2', name: 'Integrasi WhatsApp', slug: 'integrasi-whatsapp' },
  { id: 'cat-3', name: 'Manajemen Tim & Agen', slug: 'manajemen-tim-dan-agen' },
  { id: 'cat-4', name: 'Pengaturan Otomasi & SLA', slug: 'pengaturan-otomasi-dan-sla' },
]

export const DEFAULT_ARTICLE_DATA: HelpCenterArticleFormData = {
  categoryId: 'cat-1',
  title: 'Panduan Awal Menghubungkan Saluran Komunikasi',
  slug: 'panduan-awal-menghubungkan-saluran-komunikasi',
  contentMarkdown: `# Panduan Awal Menghubungkan Saluran Komunikasi

Selamat datang di platform **Xatxoot Omnichannel Customer Support**!

## Langkah 1: Memilih Saluran
Buka menu navigasi di bilah kiri, lalu pilih **Saluran**. Anda dapat memilih:
- **WhatsApp Cloud API** (Nomor resmi bisnis Meta)
- **WhatsApp Gateway (Baileys)** (Pairing via QR Code)
- **Website Live Chat Widget**

## Langkah 2: Menghubungkan Nomor
> Pastikan nomor WhatsApp yang didaftarkan aktif dan dapat menerima kode verifikasi OTP.

\`\`\`bash
# Verifikasi integrasi webhook
curl -X GET "https://api.xatxoot.local/api/v1/health"
\`\`\`

Jika Anda menemui kendala, hubungi tim support kami melalui kontak di pojok kanan bawah.
`,
  status: 'draft',
  authorName: 'Admin Support',
}

// ==========================================
// Main HelpCenterEditor Component
// ==========================================

export function HelpCenterEditor({
  initialData = DEFAULT_ARTICLE_DATA,
  categories = DEFAULT_HELP_CATEGORIES,
  onSave = () => {},
  onPublish = () => {},
  onCancel = () => {},
  className = '',
  children,
}: HelpCenterEditorProps) {
  const [title, setTitle] = useState(initialData.title || '')
  const [slug, setSlug] = useState(
    initialData.slug || generateSlugFromTitle(initialData.title || ''),
  )
  const [categoryId, setCategoryId] = useState(initialData.categoryId || categories[0]?.id || '')
  const [status, setStatus] = useState<ArticleStatus>(initialData.status || 'draft')
  const [contentMarkdown, setContentMarkdown] = useState(initialData.contentMarkdown || '')
  const [viewMode, setViewMode] = useState<EditorViewMode>('split')
  const [isSlugAuto, setIsSlugAuto] = useState(!initialData.slug)

  const readingTime = useMemo(() => calculateReadingTimeMinutes(contentMarkdown), [contentMarkdown])
  const wordCount = useMemo(
    () => (contentMarkdown.trim() ? contentMarkdown.trim().split(/\s+/).filter(Boolean).length : 0),
    [contentMarkdown],
  )
  const previewHtml = useMemo(() => renderMarkdownToHtml(contentMarkdown), [contentMarkdown])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (isSlugAuto) {
      setSlug(generateSlugFromTitle(val))
    }
  }

  const handleSlugChange = (val: string) => {
    setSlug(val)
    setIsSlugAuto(false)
  }

  const insertMarkdown = (prefix: string, suffix = '') => {
    setContentMarkdown((prev) => `${prev}\n${prefix}${suffix}`)
  }

  const handleSaveDraft = () => {
    const data: HelpCenterArticleFormData = {
      ...initialData,
      categoryId,
      title,
      slug: slug || generateSlugFromTitle(title),
      contentMarkdown,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    }
    setStatus('draft')
    onSave(data)
  }

  const handlePublish = () => {
    const data: HelpCenterArticleFormData = {
      ...initialData,
      categoryId,
      title,
      slug: slug || generateSlugFromTitle(title),
      contentMarkdown,
      status: 'published',
      updatedAt: new Date().toISOString(),
    }
    setStatus('published')
    onPublish(data)
  }

  return (
    <div
      data-testid="help-center-editor"
      className={`min-h-full w-full bg-wa-header-bg p-4 sm:p-6 lg:p-8 flex flex-col space-y-4 ${className}`}
    >
      {/* Top Header & Action Buttons */}
      <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <h1 className="text-xl sm:text-2xl font-bold text-wa-text-primary tracking-tight">
              Editor Artikel Basis Pengetahuan
            </h1>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                status === 'published'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : status === 'archived'
                    ? 'bg-gray-100 text-gray-700 border border-gray-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {status}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Tulis panduan artikel rich markdown untuk Help Center publik & penyisipan pesan chat
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            data-testid="btn-save-draft"
            onClick={handleSaveDraft}
            className="text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 px-3.5 py-2 rounded-lg border border-gray-300 shadow-sm transition-colors cursor-pointer"
          >
            Simpan Draft
          </button>
          <button
            type="button"
            data-testid="btn-publish-article"
            onClick={handlePublish}
            className="text-xs font-semibold text-white bg-wa-teal-primary hover:bg-wa-teal-hover px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>🚀</span>
            <span>Publikasikan</span>
          </button>
        </div>
      </div>

      {/* Metadata Configuration Box (Title, Slug, Category, Status) */}
      <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Title Input */}
        <div className="lg:col-span-2">
          <label
            htmlFor="article-title-input"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Judul Artikel
          </label>
          <input
            id="article-title-input"
            type="text"
            data-testid="article-title-input"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Contoh: Cara Menghubungkan WhatsApp Gateway"
            className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent"
          />
        </div>

        {/* Slug Input */}
        <div>
          <label
            htmlFor="article-slug-input"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Slug URL (Kebab-case)
          </label>
          <div className="relative">
            <input
              id="article-slug-input"
              type="text"
              data-testid="article-slug-input"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="cara-menghubungkan-whatsapp"
              className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent text-gray-700"
            />
            {isSlugAuto && (
              <span className="absolute right-2.5 top-2.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                auto
              </span>
            )}
          </div>
        </div>

        {/* Category & Status Row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="article-category-select"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Kategori
            </label>
            <select
              id="article-category-select"
              data-testid="article-category-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent text-gray-700 cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="article-status-select"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Status
            </label>
            <select
              id="article-status-select"
              data-testid="article-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as ArticleStatus)}
              className="w-full text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent text-gray-700 cursor-pointer"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Editor Main Container with Toolbar & Stat Counters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
        {/* Markdown Formatting Toolbar */}
        <div className="p-2 sm:p-3 border-b border-gray-100 bg-gray-50/70 flex flex-wrap items-center justify-between gap-2">
          {/* Action Format Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              data-testid="toolbar-bold"
              onClick={() => insertMarkdown('**Teks Tebal**')}
              title="Tebal (Bold)"
              className="w-7 h-7 flex items-center justify-center font-bold text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              B
            </button>
            <button
              type="button"
              data-testid="toolbar-italic"
              onClick={() => insertMarkdown('*Teks Miring*')}
              title="Miring (Italic)"
              className="w-7 h-7 flex items-center justify-center italic text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              I
            </button>
            <div className="w-[1px] h-4 bg-gray-300 mx-1" />
            <button
              type="button"
              data-testid="toolbar-h1"
              onClick={() => insertMarkdown('# Judul Utama')}
              title="Heading 1"
              className="px-1.5 h-7 flex items-center justify-center font-bold text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              H1
            </button>
            <button
              type="button"
              data-testid="toolbar-h2"
              onClick={() => insertMarkdown('## Sub Judul')}
              title="Heading 2"
              className="px-1.5 h-7 flex items-center justify-center font-bold text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              H2
            </button>
            <div className="w-[1px] h-4 bg-gray-300 mx-1" />
            <button
              type="button"
              data-testid="toolbar-quote"
              onClick={() => insertMarkdown('> Kutipan atau catatan penting')}
              title="Kutipan (Quote)"
              className="w-7 h-7 flex items-center justify-center text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              ❝
            </button>
            <button
              type="button"
              data-testid="toolbar-code"
              onClick={() => insertMarkdown('```ts\n// Kode di sini\n```')}
              title="Blok Kode (Code Block)"
              className="w-7 h-7 flex items-center justify-center font-mono text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              &lt;&gt;
            </button>
            <button
              type="button"
              data-testid="toolbar-list-ul"
              onClick={() => insertMarkdown('- Item poin')}
              title="Daftar Poin (List)"
              className="w-7 h-7 flex items-center justify-center text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              •
            </button>
            <button
              type="button"
              data-testid="toolbar-list-ol"
              onClick={() => insertMarkdown('1. Langkah pertama')}
              title="Daftar Angka (Ordered List)"
              className="w-7 h-7 flex items-center justify-center text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              1.
            </button>
            <div className="w-[1px] h-4 bg-gray-300 mx-1" />
            <button
              type="button"
              data-testid="toolbar-link"
              onClick={() => insertMarkdown('[Tautan](https://example.com)')}
              title="Sisipkan Tautan"
              className="w-7 h-7 flex items-center justify-center text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              🔗
            </button>
            <button
              type="button"
              data-testid="toolbar-table"
              onClick={() =>
                insertMarkdown('| Judul 1 | Judul 2 |\n|---|---|\n| Nilai 1 | Nilai 2 |')
              }
              title="Sisipkan Tabel"
              className="w-7 h-7 flex items-center justify-center text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              ▦
            </button>
          </div>

          {/* View Mode Switcher (Split, Edit, Preview) */}
          <div className="flex items-center gap-1 bg-gray-200/80 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'edit'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Editor Body Grid: Textarea and Live Preview */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 min-h-[420px]">
          {/* Markdown Textarea */}
          {(viewMode === 'split' || viewMode === 'edit') && (
            <div className={`flex flex-col h-full ${viewMode === 'edit' ? 'md:col-span-2' : ''}`}>
              <textarea
                data-testid="markdown-textarea"
                value={contentMarkdown}
                onChange={(e) => setContentMarkdown(e.target.value)}
                placeholder="Tulis konten artikel basis pengetahuan Anda di sini menggunakan Markdown..."
                className="w-full flex-1 p-4 font-mono text-xs sm:text-sm leading-relaxed text-gray-800 resize-none focus:outline-none"
              />
            </div>
          )}

          {/* Live Markdown Preview */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div
              className={`flex flex-col h-full bg-white overflow-y-auto ${
                viewMode === 'preview' ? 'md:col-span-2' : ''
              }`}
            >
              <div className="p-2 bg-gray-50/50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Live Preview</span>
                <span className="text-gray-500 font-normal">Rendering Standar Help Center</span>
              </div>
              <div
                data-testid="markdown-live-preview"
                className="p-6 prose prose-sm max-w-none prose-emerald space-y-3 text-gray-800 leading-relaxed"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized safe markdown HTML
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>

        {/* Footer Stat Counter (Word Count & Reading Time) */}
        <div className="p-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>{wordCount} kata</span>
            <span>{contentMarkdown.length} karakter</span>
            <span
              data-testid="reading-time-indicator"
              className="flex items-center gap-1 font-medium text-gray-700"
            >
              <span>⏱️</span> {readingTime} menit membaca
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span>Markdown Flavored Help Center</span>
          </div>
        </div>
      </div>

      {children}
    </div>
  )
}

export default HelpCenterEditor
