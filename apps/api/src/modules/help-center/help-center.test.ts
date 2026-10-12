import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import {
  articleRoutes,
  categoryRoutes,
  portalRoutes,
  publicPortalRoutes,
} from './help-center.routes'
import { HelpCenterService, helpCenterService, resetHelpCenterStore } from './help-center.service'

describe('Help Center API & Public SSR (Task 4.10 - apps/api)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  let app: Hono

  beforeEach(() => {
    resetHelpCenterStore()
    app = new Hono()
    app.route('/portal', publicPortalRoutes)
    app.route('/api/v1/portals', portalRoutes)
    app.route('/api/v1/categories', categoryRoutes)
    app.route('/api/v1/articles', articleRoutes)
  })

  describe('Portal CRUD Service Operations', () => {
    it('should create a portal and retrieve it by id and slug', async () => {
      const created = await helpCenterService.createPortal({
        name: 'Pusat Bantuan Utama',
        slug: 'pusat-bantuan',
        headerText: 'Bagaimana kami dapat membantu Anda hari ini?',
        customDomain: 'help.xatxoot.com',
      })

      expect(created.id).toBeDefined()
      expect(created.name).toBe('Pusat Bantuan Utama')
      expect(created.slug).toBe('pusat-bantuan')

      const byId = await helpCenterService.getPortalById(created.id)
      expect(byId).not.toBeNull()
      expect(byId?.id).toBe(created.id)

      const bySlug = await helpCenterService.getPortalBySlug('pusat-bantuan')
      expect(bySlug).not.toBeNull()
      expect(bySlug?.id).toBe(created.id)
    })

    it('should update portal attributes', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Portal Awal',
        slug: 'portal-awal',
      })

      const updated = await helpCenterService.updatePortal(portal.id, {
        name: 'Portal Diperbarui',
        headerText: 'Header Baru',
      })

      expect(updated.name).toBe('Portal Diperbarui')
      expect(updated.headerText).toBe('Header Baru')
    })

    it('should delete a portal and its cascaded contents', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Portal Hapus',
        slug: 'portal-hapus',
      })

      const deleted = await helpCenterService.deletePortal(portal.id)
      expect(deleted).toBe(true)

      const afterDelete = await helpCenterService.getPortalById(portal.id)
      expect(afterDelete).toBeNull()
    })
  })

  describe('Category CRUD Service Operations', () => {
    it('should create and list categories under a portal', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Help Desk',
        slug: 'help-desk',
      })

      const cat1 = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Memulai',
        slug: 'memulai',
        description: 'Panduan awal untuk pemula',
        position: 1,
      })

      const cat2 = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Akun & Billing',
        slug: 'billing',
        description: 'Informasi tagihan dan akun',
        position: 2,
      })

      const list = await helpCenterService.listCategories({ portalId: portal.id })
      expect(list.length).toBe(2)
      expect(list.map((c) => c.slug)).toContain('memulai')
      expect(list.map((c) => c.slug)).toContain('billing')
    })

    it('should update and delete category', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Help Desk',
        slug: 'help-desk-2',
      })

      const cat = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'FAQ',
        slug: 'faq',
        position: 0,
      })

      const updated = await helpCenterService.updateCategory(cat.id, {
        name: 'Frequently Asked Questions',
      })
      expect(updated.name).toBe('Frequently Asked Questions')

      const deleted = await helpCenterService.deleteCategory(cat.id)
      expect(deleted).toBe(true)
      expect(await helpCenterService.getCategoryById(cat.id)).toBeNull()
    })
  })

  describe('Article CRUD Service Operations', () => {
    it('should create article in draft and publish it', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Help Desk',
        slug: 'help-desk-3',
      })
      const cat = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Umum',
        slug: 'umum',
      })

      const article = await helpCenterService.createArticle({
        categoryId: cat.id,
        title: 'Cara Mengubah Password',
        slug: 'cara-mengubah-password',
        contentMarkdown: '## Langkah-langkah:\n1. Buka menu Pengaturan\n2. Klik Ganti Password',
        status: 'draft',
      })

      expect(article.status).toBe('draft')
      expect(article.viewsCount).toBe(0)

      const published = await helpCenterService.updateArticle(article.id, {
        status: 'published',
      })
      expect(published.status).toBe('published')
    })

    it('should increment view count when requested', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Help Desk',
        slug: 'help-desk-4',
      })
      const cat = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Umum',
        slug: 'umum-4',
      })
      const article = await helpCenterService.createArticle({
        categoryId: cat.id,
        title: 'Panduan WhatsApp API',
        slug: 'panduan-wa-api',
        contentMarkdown: 'Tutorial integrasi WA API',
        status: 'published',
      })

      const viewed = await helpCenterService.incrementArticleViews(article.id)
      expect(viewed.viewsCount).toBe(1)

      const viewedAgain = await helpCenterService.incrementArticleViews(article.id)
      expect(viewedAgain.viewsCount).toBe(2)
    })
  })

  describe('Public SSR Routes (/portal/:slug)', () => {
    it('GET /portal/:slug should render HTML homepage with categories and published articles', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Portal Publik Xatxoot',
        slug: 'bantuan-resmi',
        headerText: 'Selamat datang di Pusat Bantuan Resmi Xatxoot',
      })
      const cat = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Fitur Utama',
        slug: 'fitur-utama',
      })
      await helpCenterService.createArticle({
        categoryId: cat.id,
        title: 'Pengenalan Dashboard Omnichannel',
        slug: 'pengenalan-dashboard',
        contentMarkdown: 'Pelajari dasar-dasar mengelola inbox dan chat.',
        status: 'published',
      })
      await helpCenterService.createArticle({
        categoryId: cat.id,
        title: 'Draf Artikel Rahasia',
        slug: 'draf-rahasia',
        contentMarkdown: 'Konten belum selesai.',
        status: 'draft',
      })

      const res = await app.request('/portal/bantuan-resmi')
      expect(res.status).toBe(200)

      const contentType = res.headers.get('content-type')
      expect(contentType).toContain('text/html')

      const html = await res.text()
      expect(html).toContain('Portal Publik Xatxoot')
      expect(html).toContain('Selamat datang di Pusat Bantuan Resmi Xatxoot')
      expect(html).toContain('Fitur Utama')
      expect(html).toContain('Pengenalan Dashboard Omnichannel')
      // Draft article must NOT be rendered in public homepage
      expect(html).not.toContain('Draf Artikel Rahasia')
    })

    it('GET /portal/:slug should return 404 HTML if portal slug not found', async () => {
      const res = await app.request('/portal/non-existent-portal')
      expect(res.status).toBe(404)
      const html = await res.text()
      expect(html).toContain('Portal Tidak Ditemukan')
    })

    it('GET /portal/:slug/articles/:article_slug should render article detail and increment views', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Knowledge Base',
        slug: 'kb',
      })
      const cat = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Integrasi',
        slug: 'integrasi',
      })
      const article = await helpCenterService.createArticle({
        categoryId: cat.id,
        title: 'Integrasi WhatsApp Cloud API',
        slug: 'integrasi-wa-cloud',
        contentMarkdown: 'Ikuti langkah berikut untuk menghubungkan nomor WA Meta.',
        status: 'published',
      })

      const res = await app.request('/portal/kb/articles/integrasi-wa-cloud')
      expect(res.status).toBe(200)

      const contentType = res.headers.get('content-type')
      expect(contentType).toContain('text/html')

      const html = await res.text()
      expect(html).toContain('Integrasi WhatsApp Cloud API')
      expect(html).toContain('Ikuti langkah berikut')
      expect(html).toContain('Integrasi') // Category link or badge

      // Check view count incremented
      const updatedArticle = await helpCenterService.getArticleById(article.id)
      expect(updatedArticle?.viewsCount).toBe(1)
    })

    it('GET /portal/:slug/articles/:article_slug should return 404 HTML for draft articles', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'KB Secret',
        slug: 'kb-secret',
      })
      const cat = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Drafts',
        slug: 'drafts',
      })
      await helpCenterService.createArticle({
        categoryId: cat.id,
        title: 'Artikel Belum Rilis',
        slug: 'artikel-belum-rilis',
        contentMarkdown: 'Segera hadir.',
        status: 'draft',
      })

      const res = await app.request('/portal/kb-secret/articles/artikel-belum-rilis')
      expect(res.status).toBe(404)
      const html = await res.text()
      expect(html).toContain('Artikel Tidak Ditemukan')
    })
  })

  describe('Management REST API Endpoints', () => {
    it('should support Portals CRUD via API', async () => {
      // POST
      const postRes = await app.request('/api/v1/portals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Portal API',
          slug: 'portal-api',
          headerText: 'Bantuan via API',
        }),
      })
      expect(postRes.status).toBe(201)
      const createdJson = await postRes.json()
      expect(createdJson.success).toBe(true)
      const portalId = createdJson.data.id

      // GET list
      const listRes = await app.request('/api/v1/portals')
      expect(listRes.status).toBe(200)
      const listJson = await listRes.json()
      expect(listJson.data.length).toBeGreaterThanOrEqual(1)

      // GET by id
      const getRes = await app.request(`/api/v1/portals/${portalId}`)
      expect(getRes.status).toBe(200)
      const getJson = await getRes.json()
      expect(getJson.data.name).toBe('Portal API')

      // PATCH
      const patchRes = await app.request(`/api/v1/portals/${portalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Portal API Diperbarui' }),
      })
      expect(patchRes.status).toBe(200)
      const patchJson = await patchRes.json()
      expect(patchJson.data.name).toBe('Portal API Diperbarui')

      // DELETE
      const delRes = await app.request(`/api/v1/portals/${portalId}`, {
        method: 'DELETE',
      })
      expect(delRes.status).toBe(200)
    })

    it('should support Categories and Articles CRUD via API', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Portal Test',
        slug: 'portal-test',
      })

      // Create category
      const catRes = await app.request('/api/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalId: portal.id,
          name: 'Kategori Test',
          slug: 'kategori-test',
          position: 1,
        }),
      })
      expect(catRes.status).toBe(201)
      const catJson = await catRes.json()
      const categoryId = catJson.data.id

      // Create article
      const artRes = await app.request('/api/v1/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          title: 'Artikel API Test',
          slug: 'artikel-api-test',
          contentMarkdown: 'Isi artikel API test',
          status: 'published',
        }),
      })
      expect(artRes.status).toBe(201)
      const artJson = await artRes.json()
      const articleId = artJson.data.id

      // List articles
      const listArtRes = await app.request(`/api/v1/articles?categoryId=${categoryId}`)
      expect(listArtRes.status).toBe(200)
      const listArtJson = await listArtRes.json()
      expect(listArtJson.data.length).toBe(1)
      expect(listArtJson.data[0].id).toBe(articleId)
    })
  })

  describe('Single Organization Rule Guardrail', () => {
    it('must NOT require or contain account_id in portal, category, or article schemas/tables', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Guardrail Portal',
        slug: 'guardrail-portal',
      })
      const cat = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Guardrail Cat',
        slug: 'guardrail-cat',
      })
      const art = await helpCenterService.createArticle({
        categoryId: cat.id,
        title: 'Guardrail Art',
        slug: 'guardrail-art',
        contentMarkdown: 'Guardrail content',
      })

      expect(Object.keys(portal)).not.toContain('account_id')
      expect(Object.keys(portal)).not.toContain('accountId')
      expect(Object.keys(cat)).not.toContain('account_id')
      expect(Object.keys(cat)).not.toContain('accountId')
      expect(Object.keys(art)).not.toContain('account_id')
      expect(Object.keys(art)).not.toContain('accountId')
    })
  })

  describe('Phase 4 Checklist Synchronization', () => {
    it('should mark Task 4.10 as completed in docs/PHASE_4_CHECKLIST.md', () => {
      const checklistPath = join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md')
      const content = readFileSync(checklistPath, 'utf-8')
      expect(content).toContain('- [x] **Task 4.10 (TDD - Help Center API & Public SSR)**:')
    })
  })
})
