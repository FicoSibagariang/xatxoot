import type { Context } from 'hono'
import { ragService } from './rag.service'

export class RagController {
  async search(c: Context) {
    try {
      const body = await c.req.json()
      const query = body?.query
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return c.json({ success: false, message: 'Query pencarian wajib diisi' }, 400)
      }

      const limit = typeof body.limit === 'number' ? body.limit : undefined
      const threshold = typeof body.threshold === 'number' ? body.threshold : undefined

      const results = await ragService.searchSimilarArticles(query.trim(), {
        limit,
        threshold,
      })

      return c.json({ success: true, data: results })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mencari artikel semantik'
      return c.json({ success: false, message }, 500)
    }
  }

  async indexArticle(c: Context) {
    try {
      const articleId = c.req.param('articleId')
      if (!articleId) {
        return c.json({ success: false, message: 'articleId wajib diisi' }, 400)
      }

      const result = await ragService.indexArticle(articleId)
      return c.json({ success: true, data: result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengindeks artikel'
      return c.json({ success: false, message }, 500)
    }
  }

  async reindexAll(c: Context) {
    try {
      const result = await ragService.reindexAllPublishedArticles()
      return c.json({ success: true, data: result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal reindex semua artikel'
      return c.json({ success: false, message }, 500)
    }
  }
}

export const ragController = new RagController()
