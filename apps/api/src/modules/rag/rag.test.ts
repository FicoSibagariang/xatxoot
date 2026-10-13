import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { helpCenterService, resetHelpCenterStore } from '../help-center/help-center.service'
import { chunkText } from './chunker'
import { cosineSimilarity, formatVectorForPg, generateEmbedding } from './embedding.service'
import { ragRoutes } from './rag.routes'
import { RAG_EMBEDDING_DIMENSION, RagService, ragService, resetRagStore } from './rag.service'

describe('Vector & RAG Search Engine (Task 5.9 - apps/api)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  let app: Hono

  beforeEach(() => {
    resetHelpCenterStore()
    resetRagStore()
    app = new Hono()
    app.route('/api/v1/rag', ragRoutes)
  })

  describe('1. Text Chunker (chunkText)', () => {
    it('should return empty array for empty or whitespace-only text', () => {
      expect(chunkText('')).toEqual([])
      expect(chunkText('   \n\n\t  ')).toEqual([])
    })

    it('should return single chunk if text is smaller than chunkSize', () => {
      const text = 'Panduan singkat cara mengintegrasikan WhatsApp Cloud API di Xatxoot.'
      const chunks = chunkText(text, { chunkSize: 200, chunkOverlap: 50 })
      expect(chunks.length).toBe(1)
      expect(chunks[0]).toBe(text)
    })

    it('should split long text into multiple chunks respecting chunkSize and chunkOverlap', () => {
      const paragraph1 =
        'WhatsApp Cloud API adalah solusi resmi dari Meta untuk bisnis berskala menengah hingga enterprise. ' +
        'Dengan integrasi ini, pengguna dapat mengirimkan pesan template, menerima pesan pelanggan secara real-time, ' +
        'dan mengelola kontak melalui satu antarmuka inbox bersama.'
      const paragraph2 =
        'Untuk memulai integrasi, Anda perlu membuat Meta Business Account, menambahkan nomor telepon bisnis, ' +
        'dan memperoleh System User Access Token dengan izin whatsapp_business_messaging.'
      const paragraph3 =
        'Pastikan webhook terverifikasi dengan memasukkan Verify Token yang sama dengan konfigurasi di dashboard Xatxoot. ' +
        'Setiap pesan masuk akan otomatis didistribusikan ke inbox dan agent yang bertugas.'

      const fullText = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`
      const chunks = chunkText(fullText, { chunkSize: 180, chunkOverlap: 40 })

      expect(chunks.length).toBeGreaterThan(1)
      for (const chunk of chunks) {
        expect(chunk.length).toBeGreaterThan(0)
        expect(chunk.length).toBeLessThanOrEqual(250) // Toleransi batas kata
      }
    })
  })

  describe('2. Embedding Service (generateEmbedding & Cosine Similarity)', () => {
    it('should generate 1536-dimensional embedding vectors', async () => {
      const embedding = await generateEmbedding('Cara menghubungkan nomor WhatsApp Cloud')
      expect(embedding).toBeArray()
      expect(embedding.length).toBe(RAG_EMBEDDING_DIMENSION)
      expect(embedding.length).toBe(1536)

      // Memastikan tiap elemen adalah floating number
      for (let i = 0; i < 10; i++) {
        expect(typeof embedding[i]).toBe('number')
      }
    })

    it('should produce identical embeddings for identical text (deterministic)', async () => {
      const text = 'SLA monitoring dan reminder waktu respon'
      const emb1 = await generateEmbedding(text)
      const emb2 = await generateEmbedding(text)
      expect(emb1).toEqual(emb2)
    })

    it('should format vector array into PostgreSQL pgvector string format', () => {
      const smallVector = [0.1234, -0.5678, 0.99]
      const formatted = formatVectorForPg(smallVector)
      expect(formatted).toBe('[0.1234,-0.5678,0.99]')
    })

    it('should correctly calculate cosine similarity between vectors', () => {
      const vecA = [1, 0, 0]
      const vecB = [1, 0, 0]
      const vecC = [0, 1, 0]
      const vecD = [-1, 0, 0]

      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 4) // Identik
      expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0, 4) // Ortogonal
      expect(cosineSimilarity(vecA, vecD)).toBeCloseTo(-1.0, 4) // Berlawanan arah
    })
  })

  describe('3. Article Indexing Worker (RagService.indexArticle)', () => {
    it('should index published article into chunks and embeddings', async () => {
      const portal = await helpCenterService.createPortal({
        name: 'Pusat Bantuan',
        slug: 'kb',
      })
      const category = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Integrasi',
        slug: 'integrasi',
      })
      const article = await helpCenterService.createArticle({
        categoryId: category.id,
        title: 'Panduan Integrasi WhatsApp Cloud API',
        slug: 'wa-cloud-guide',
        contentMarkdown:
          'Langkah-langkah integrasi WhatsApp Cloud API ke sistem Xatxoot.\n\n' +
          '1. Dapatkan Access Token dari Meta Business Developer.\n' +
          '2. Daftarkan nomor telepon di Business Manager.\n' +
          '3. Konfigurasikan Webhook URL dan Webhook Verify Token.',
        status: 'published',
      })

      const indexResult = await ragService.indexArticle(article.id)
      expect(indexResult.indexed).toBe(true)
      expect(indexResult.articleId).toBe(article.id)
      expect(indexResult.chunksCount).toBeGreaterThan(0)

      const storedEmbeddings = await ragService.getArticleEmbeddings(article.id)
      expect(storedEmbeddings.length).toBe(indexResult.chunksCount)
      expect(storedEmbeddings[0].chunkText).toContain('WhatsApp Cloud API')
    })

    it('should NOT index draft articles and clear existing embeddings if unpublished', async () => {
      const portal = await helpCenterService.createPortal({ name: 'KB', slug: 'kb-draft' })
      const category = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Drafts',
        slug: 'drafts',
      })
      const article = await helpCenterService.createArticle({
        categoryId: category.id,
        title: 'Artikel Rahasia Belum Rilis',
        slug: 'draft-article',
        contentMarkdown: 'Konten internal yang belum boleh dicari oleh siapapun.',
        status: 'draft',
      })

      const indexResult = await ragService.indexArticle(article.id)
      expect(indexResult.indexed).toBe(false)
      expect(indexResult.chunksCount).toBe(0)

      const embeddings = await ragService.getArticleEmbeddings(article.id)
      expect(embeddings.length).toBe(0)
    })

    it('should remove embeddings when article is deleted or unpublished', async () => {
      const portal = await helpCenterService.createPortal({ name: 'KB', slug: 'kb-del' })
      const category = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Umum',
        slug: 'umum',
      })
      const article = await helpCenterService.createArticle({
        categoryId: category.id,
        title: 'Artikel Yang Akan Dihapus',
        slug: 'artikel-hapus',
        contentMarkdown: 'Informasi sementara mengenai maintenance server.',
        status: 'published',
      })

      await ragService.indexArticle(article.id)
      expect((await ragService.getArticleEmbeddings(article.id)).length).toBeGreaterThan(0)

      await ragService.removeArticleEmbeddings(article.id)
      expect((await ragService.getArticleEmbeddings(article.id)).length).toBe(0)
    })
  })

  describe('4. Semantic Vector Search Query (PostgreSQL pgvector <=> operator simulation)', () => {
    it('should find most relevant article chunks based on cosine similarity', async () => {
      const portal = await helpCenterService.createPortal({ name: 'KB', slug: 'kb-search' })
      const category = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Layanan',
        slug: 'layanan',
      })

      const articleWA = await helpCenterService.createArticle({
        categoryId: category.id,
        title: 'Setup Nomor WhatsApp Bisnis',
        slug: 'setup-wa-bisnis',
        contentMarkdown:
          'Panduan pendaftaran nomor telepon WhatsApp Business Cloud API dan QR pairing gateway.',
        status: 'published',
      })

      const articleBilling = await helpCenterService.createArticle({
        categoryId: category.id,
        title: 'Faktur Tagihan dan Pembayaran Invoice',
        slug: 'tagihan-invoice',
        contentMarkdown:
          'Cara melihat struk tagihan bulanan dan metode pembayaran kartu kredit atau transfer bank.',
        status: 'published',
      })

      await ragService.indexArticle(articleWA.id)
      await ragService.indexArticle(articleBilling.id)

      const searchResults = await ragService.searchSimilarArticles('cara setting whatsapp cloud', {
        limit: 3,
        threshold: 0.1,
      })

      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchResults[0].articleId).toBe(articleWA.id)
      expect(searchResults[0].title).toBe('Setup Nomor WhatsApp Bisnis')
      expect(searchResults[0].similarity).toBeGreaterThan(0)
    })

    it('should respect search limit and threshold filters', async () => {
      const portal = await helpCenterService.createPortal({ name: 'KB', slug: 'kb-thresh' })
      const category = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'General',
        slug: 'general',
      })

      for (let i = 1; i <= 5; i++) {
        const art = await helpCenterService.createArticle({
          categoryId: category.id,
          title: `Artikel Pengetahuan Nomor ${i}`,
          slug: `artikel-${i}`,
          contentMarkdown: `Isi panduan nomor ${i} mengenai troubleshooting help center dan FAQ.`,
          status: 'published',
        })
        await ragService.indexArticle(art.id)
      }

      const results = await ragService.searchSimilarArticles('troubleshooting FAQ', {
        limit: 2,
      })
      expect(results.length).toBeLessThanOrEqual(2)
    })
  })

  describe('5. RAG HTTP Endpoints (/api/v1/rag)', () => {
    it('POST /api/v1/rag/search should return semantic search results', async () => {
      const portal = await helpCenterService.createPortal({ name: 'KB', slug: 'kb-http' })
      const category = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'FAQ',
        slug: 'faq',
      })
      const article = await helpCenterService.createArticle({
        categoryId: category.id,
        title: 'Konfigurasi SSO Okta SAML Enterprise',
        slug: 'sso-okta',
        contentMarkdown:
          'Pengaturan single sign on perusahaan menggunakan protokol SAML 2.0 dan Okta IdP.',
        status: 'published',
      })
      await ragService.indexArticle(article.id)

      const res = await app.request('/api/v1/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'login okta saml enterprise sso',
          limit: 3,
        }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.length).toBeGreaterThan(0)
      expect(json.data[0].articleId).toBe(article.id)
    })

    it('POST /api/v1/rag/index/:articleId should trigger manual article indexing', async () => {
      const portal = await helpCenterService.createPortal({ name: 'KB', slug: 'kb-manual' })
      const category = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Manual',
        slug: 'manual',
      })
      const article = await helpCenterService.createArticle({
        categoryId: category.id,
        title: 'Manual Reindex Article',
        slug: 'manual-reindex',
        contentMarkdown: 'Artikel untuk diindeks ulang secara eksplisit via REST API endpoint.',
        status: 'published',
      })

      const res = await app.request(`/api/v1/rag/index/${article.id}`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.indexed).toBe(true)
      expect(json.data.chunksCount).toBeGreaterThan(0)
    })
  })

  describe('6. Single Organization Guardrail & Phase 5 Checklist', () => {
    it('should strictly NOT require or contain account_id or accountId in vector embeddings', async () => {
      const portal = await helpCenterService.createPortal({ name: 'KB', slug: 'kb-guard' })
      const category = await helpCenterService.createCategory({
        portalId: portal.id,
        name: 'Guard',
        slug: 'guard',
      })
      const article = await helpCenterService.createArticle({
        categoryId: category.id,
        title: 'Guardrail Article',
        slug: 'guardrail-art',
        contentMarkdown: 'Testing single org guardrail',
        status: 'published',
      })
      await ragService.indexArticle(article.id)

      const embeddings = await ragService.getArticleEmbeddings(article.id)
      for (const emb of embeddings) {
        expect((emb as Record<string, unknown>).account_id).toBeUndefined()
        expect((emb as Record<string, unknown>).accountId).toBeUndefined()
      }
    })

    it('should have Task 5.9 marked as completed in docs/PHASE_5_CHECKLIST.md', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 5.9 (TDD - Vector & RAG Search Engine)**:')
    })
  })
})
