import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  type HelpCenterArticleFormData,
  type HelpCenterCategoryOption,
  HelpCenterEditor,
  calculateReadingTimeMinutes,
  generateSlugFromTitle,
  renderMarkdownToHtml,
} from './HelpCenterEditor'

describe('Help Center Rich Markdown Editor (Task 4.14 - apps/web)', () => {
  const mockCategories: HelpCenterCategoryOption[] = [
    { id: 'cat-1', name: 'Panduan Memulai', slug: 'panduan-memulai' },
    { id: 'cat-2', name: 'Integrasi WhatsApp', slug: 'integrasi-whatsapp' },
    { id: 'cat-3', name: 'Manajemen Tim & Agen', slug: 'manajemen-tim-dan-agen' },
  ]

  const mockArticle: HelpCenterArticleFormData = {
    id: 'art-101',
    categoryId: 'cat-2',
    title: 'Cara Menghubungkan WhatsApp Gateway via QR Code',
    slug: 'cara-menghubungkan-whatsapp-gateway-via-qr-code',
    contentMarkdown: `# Panduan WhatsApp Gateway

Berikut adalah langkah-langkah menghubungkan nomor WhatsApp:

1. Buka menu **Pengaturan Saluran**.
2. Pilih saluran *WhatsApp Baileys*.
3. Pindai kode QR yang muncul di layar dengan aplikasi WhatsApp Anda.

> Catatan: Pastikan koneksi internet ponsel stabil selama proses pairing.

\`\`\`bash
# Endpoint cek kesehatan gateway
curl https://api.xatxoot.local/api/v1/health
\`\`\`
`,
    status: 'draft',
    authorName: 'Sarah CS',
  }

  describe('Slug & Reading Time Helpers', () => {
    it('should generate valid URL-friendly kebab-case slug from title', () => {
      expect(generateSlugFromTitle('Cara Menghubungkan WhatsApp!')).toBe(
        'cara-menghubungkan-whatsapp',
      )
      expect(generateSlugFromTitle('Panduan Lengkap: Integrasi API v1.0 & Webhook 2026')).toBe(
        'panduan-lengkap-integrasi-api-v1-0-webhook-2026',
      )
      expect(generateSlugFromTitle('   Spasi Berlebih   Dan Karakter @#$% Khusus   ')).toBe(
        'spasi-berlebih-dan-karakter-khusus',
      )
    })

    it('should calculate reading time in minutes based on word count', () => {
      expect(calculateReadingTimeMinutes('')).toBe(1)
      expect(calculateReadingTimeMinutes('Satu dua tiga empat lima')).toBe(1)
      const text300Words = Array.from({ length: 300 }, () => 'kata').join(' ')
      expect(calculateReadingTimeMinutes(text300Words)).toBe(2)
      const text600Words = Array.from({ length: 600 }, () => 'kata').join(' ')
      expect(calculateReadingTimeMinutes(text600Words)).toBe(3)
    })
  })

  describe('Markdown Parser & HTML Renderer', () => {
    it('should render headings, bold, italic, lists, quotes, and code blocks', () => {
      const md = `# Judul Utama
## Sub Judul
Teks dengan **tebal** dan *miring* serta \`inline code\`.

> Kutipan penting

- Item satu
- Item dua

\`\`\`ts
const status = 'ok'
\`\`\`
`
      const html = renderMarkdownToHtml(md)
      expect(html).toContain('<h1>Judul Utama</h1>')
      expect(html).toContain('<h2>Sub Judul</h2>')
      expect(html).toContain('<strong>tebal</strong>')
      expect(html).toContain('<em>miring</em>')
      expect(html).toContain('<code>inline code</code>')
      expect(html).toContain('<blockquote>')
      expect(html).toContain('Kutipan penting')
      expect(html).toContain('<li>Item satu</li>')
      expect(html).toContain('<pre><code')
    })
  })

  describe('HelpCenterEditor Component Layout & Toolbar', () => {
    it('should render title input, slug input, category selector, and status selector', () => {
      const html = renderToStaticMarkup(
        <HelpCenterEditor
          initialData={mockArticle}
          categories={mockCategories}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="help-center-editor"')
      expect(html).toContain('data-testid="article-title-input"')
      expect(html).toContain('Cara Menghubungkan WhatsApp Gateway via QR Code')
      expect(html).toContain('data-testid="article-slug-input"')
      expect(html).toContain('cara-menghubungkan-whatsapp-gateway-via-qr-code')
      expect(html).toContain('data-testid="article-category-select"')
      expect(html).toContain('Panduan Memulai')
      expect(html).toContain('Integrasi WhatsApp')
      expect(html).toContain('data-testid="article-status-select"')
      expect(html).toContain('Draft')
      expect(html).toContain('Published')
      expect(html).toContain('Archived')
    })

    it('should render full Markdown formatting toolbar buttons', () => {
      const html = renderToStaticMarkup(
        <HelpCenterEditor
          initialData={mockArticle}
          categories={mockCategories}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="toolbar-bold"')
      expect(html).toContain('data-testid="toolbar-italic"')
      expect(html).toContain('data-testid="toolbar-h1"')
      expect(html).toContain('data-testid="toolbar-h2"')
      expect(html).toContain('data-testid="toolbar-quote"')
      expect(html).toContain('data-testid="toolbar-code"')
      expect(html).toContain('data-testid="toolbar-list-ul"')
      expect(html).toContain('data-testid="toolbar-list-ol"')
      expect(html).toContain('data-testid="toolbar-link"')
      expect(html).toContain('data-testid="toolbar-table"')
    })

    it('should render live markdown preview and word count stat counters', () => {
      const html = renderToStaticMarkup(
        <HelpCenterEditor
          initialData={mockArticle}
          categories={mockCategories}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="markdown-textarea"')
      expect(html).toContain('data-testid="markdown-live-preview"')
      expect(html).toContain('<h1>Panduan WhatsApp Gateway</h1>')
      expect(html).toContain('data-testid="reading-time-indicator"')
      expect(html).toContain('menit membaca')
      expect(html).toContain('data-testid="btn-save-draft"')
      expect(html).toContain('data-testid="btn-publish-article"')
      expect(html).toContain('Simpan Draft')
      expect(html).toContain('Publikasikan')
    })
  })

  describe('Single Organization Rule Guardrail & Phase 4 Checklist', () => {
    it('should strictly NOT contain or require accountId in Help Center Editor code', () => {
      const code = readFileSync(join(__dirname, 'HelpCenterEditor.tsx'), 'utf-8')
      expect(code).not.toContain('account_id')
      expect(code).not.toContain('accountId')
    })

    it('should mark Task 4.14 as completed in docs/PHASE_4_CHECKLIST.md', () => {
      const checklist = readFileSync(
        join(__dirname, '../../../../../docs/PHASE_4_CHECKLIST.md'),
        'utf-8',
      )
      expect(checklist).toContain('- [x] **Task 4.14**')
    })
  })
})
