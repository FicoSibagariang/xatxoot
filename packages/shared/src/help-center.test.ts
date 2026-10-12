import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ArticleSchema,
  ArticleStatusSchema,
  CategorySchema,
  CreateArticleInputSchema,
  CreateCategoryInputSchema,
  CreatePortalArticleInputSchema,
  CreatePortalCategoryInputSchema,
  CreatePortalInputSchema,
  PortalArticleSchema,
  PortalCategorySchema,
  PortalSchema,
  UpdatePortalArticleInputSchema,
  UpdatePortalCategoryInputSchema,
  UpdatePortalInputSchema,
} from './schemas'

describe('Help Center & Knowledge Base Schemas (Task 4.6 - packages/shared)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..')
  const validPortalId = '123e4567-e89b-12d3-a456-426614174001'
  const validCategoryId = '123e4567-e89b-12d3-a456-426614174002'
  const validAuthorId = '123e4567-e89b-12d3-a456-426614174003'
  const validArticleId = '123e4567-e89b-12d3-a456-426614174004'

  describe('Portal Schemas', () => {
    it('should validate valid portal creation input', () => {
      const input = {
        name: 'Pusat Bantuan Pelanggan',
        slug: 'pusat-bantuan',
        customDomain: 'help.xatxoot.com',
        headerText: 'Temukan jawaban dan solusi untuk pertanyaan Anda',
        logoUrl: 'https://xatxoot.com/logo.png',
      }
      const result = CreatePortalInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Pusat Bantuan Pelanggan')
        expect(result.data.slug).toBe('pusat-bantuan')
      }
    })

    it('should reject invalid slug formats with spaces or uppercase', () => {
      expect(
        CreatePortalInputSchema.safeParse({ name: 'Portal', slug: 'Pusat Bantuan' }).success,
      ).toBe(false)
      expect(
        CreatePortalInputSchema.safeParse({ name: 'Portal', slug: 'pusat_bantuan' }).success,
      ).toBe(false)
      expect(
        CreatePortalInputSchema.safeParse({ name: 'Portal', slug: 'pusat@bantuan' }).success,
      ).toBe(false)
    })

    it('should validate update portal input', () => {
      const input = {
        name: 'Pusat Bantuan Baru',
        headerText: 'Header diperbarui',
      }
      const result = UpdatePortalInputSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('should validate full portal instance', () => {
      const portal = {
        id: validPortalId,
        name: 'Pusat Bantuan',
        slug: 'pusat-bantuan',
        customDomain: 'help.xatxoot.com',
        headerText: 'Bantuan',
        logoUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const result = PortalSchema.safeParse(portal)
      expect(result.success).toBe(true)
    })
  })

  describe('Category Schemas', () => {
    it('should validate valid category creation input', () => {
      const input = {
        portalId: validPortalId,
        name: 'Panduan Memulai',
        slug: 'panduan-memulai',
        description: 'Langkah awal penggunaan platform Xatxoot',
        position: 1,
      }
      const result = CreatePortalCategoryInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.portalId).toBe(validPortalId)
        expect(result.data.name).toBe('Panduan Memulai')
        expect(result.data.slug).toBe('panduan-memulai')
      }
    })

    it('should reject category input without portalId or invalid portalId UUID', () => {
      const input = {
        portalId: 'invalid-uuid',
        name: 'Panduan Memulai',
        slug: 'panduan-memulai',
      }
      expect(CreatePortalCategoryInputSchema.safeParse(input).success).toBe(false)
    })

    it('should validate update category input', () => {
      const input = {
        name: 'Panduan Pemula (Diperbarui)',
        position: 2,
      }
      expect(UpdatePortalCategoryInputSchema.safeParse(input).success).toBe(true)
    })

    it('should validate full category instance', () => {
      const category = {
        id: validCategoryId,
        portalId: validPortalId,
        name: 'Panduan',
        slug: 'panduan',
        description: null,
        position: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      expect(PortalCategorySchema.safeParse(category).success).toBe(true)
      expect(CategorySchema.safeParse(category).success).toBe(true)
    })
  })

  describe('Article Schemas', () => {
    it('should accept valid article statuses', () => {
      expect(ArticleStatusSchema.safeParse('draft').success).toBe(true)
      expect(ArticleStatusSchema.safeParse('published').success).toBe(true)
      expect(ArticleStatusSchema.safeParse('archived').success).toBe(true)
      expect(ArticleStatusSchema.safeParse('deleted').success).toBe(false)
    })

    it('should validate valid article creation input', () => {
      const input = {
        categoryId: validCategoryId,
        authorId: validAuthorId,
        title: 'Cara Menghubungkan Akun WhatsApp',
        slug: 'cara-menghubungkan-whatsapp',
        contentMarkdown: '# Panduan WhatsApp\n\nIkuti langkah-langkah berikut...',
        status: 'published',
      }
      const result = CreatePortalArticleInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.categoryId).toBe(validCategoryId)
        expect(result.data.title).toBe('Cara Menghubungkan Akun WhatsApp')
        expect(result.data.status).toBe('published')
      }
    })

    it('should default status to draft and markdown to empty string if not provided', () => {
      const input = {
        categoryId: validCategoryId,
        title: 'Draft Artikel Baru',
        slug: 'draft-artikel-baru',
      }
      const result = CreatePortalArticleInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('draft')
        expect(result.data.contentMarkdown).toBe('')
      }
    })

    it('should validate update article input', () => {
      const input = {
        title: 'Judul Diperbarui',
        status: 'published',
      }
      expect(UpdatePortalArticleInputSchema.safeParse(input).success).toBe(true)
    })

    it('should validate full article instance', () => {
      const article = {
        id: validArticleId,
        categoryId: validCategoryId,
        authorId: validAuthorId,
        title: 'Panduan Lengkap',
        slug: 'panduan-lengkap',
        contentMarkdown: '# Konten',
        status: 'published',
        viewsCount: 150,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      expect(PortalArticleSchema.safeParse(article).success).toBe(true)
      expect(ArticleSchema.safeParse(article).success).toBe(true)
    })
  })

  describe('Single Organization Rule & Alias Support', () => {
    it('should strictly NOT contain account_id or accountId in any Help Center schema', () => {
      const portalShape = CreatePortalInputSchema.shape as Record<string, unknown>
      const categoryShape = CreatePortalCategoryInputSchema.shape as Record<string, unknown>
      const articleShape = CreatePortalArticleInputSchema.shape as Record<string, unknown>

      expect(portalShape.accountId).toBeUndefined()
      expect(portalShape.account_id).toBeUndefined()
      expect(categoryShape.accountId).toBeUndefined()
      expect(categoryShape.account_id).toBeUndefined()
      expect(articleShape.accountId).toBeUndefined()
      expect(articleShape.account_id).toBeUndefined()
    })

    it('should verify CreateCategoryInputSchema and CreateArticleInputSchema aliases work equivalently', () => {
      expect(CreateCategoryInputSchema).toBe(CreatePortalCategoryInputSchema)
      expect(CreateArticleInputSchema).toBe(CreatePortalArticleInputSchema)
    })
  })

  describe('Checklist Verification', () => {
    it('should verify Phase 4 checklist marks Task 4.6 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 4.6**: Skema validasi artikel & kategori Help Center.',
      )
    })
  })
})
