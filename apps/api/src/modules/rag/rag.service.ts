import { randomUUID } from 'node:crypto'
import { sql } from '../../db'
import { helpCenterService } from '../help-center/help-center.service'
import { chunkText } from './chunker'
import {
  RAG_EMBEDDING_DIMENSION,
  cosineSimilarity,
  formatVectorForPg,
  generateEmbedding,
} from './embedding.service'

export { RAG_EMBEDDING_DIMENSION }

export interface ArticleEmbeddingRecord {
  id: string
  articleId: string
  chunkText: string
  embedding: number[]
  createdAt: string
}

export interface RagSearchResult {
  articleId: string
  title: string
  slug: string
  chunkText: string
  similarity: number
}

export interface IndexArticleResult {
  articleId: string
  chunksCount: number
  indexed: boolean
}

// In-memory fallback store untuk unit testing & runtime offline
const memoryStore = {
  embeddings: new Map<string, ArticleEmbeddingRecord>(),
}

export function resetRagStore(): void {
  memoryStore.embeddings.clear()
}

export class RagService {
  /**
   * Menghasilkan chunking & vector embeddings untuk artikel Help Center.
   * Hanya artikel dengan status 'published' yang diindeks.
   */
  async indexArticle(articleId: string): Promise<IndexArticleResult> {
    const article = await helpCenterService.getArticleById(articleId)

    if (!article || article.status !== 'published') {
      // Hapus indeks jika artikel di-unpublish atau tidak ditemukan
      await this.removeArticleEmbeddings(articleId)
      return { articleId, chunksCount: 0, indexed: false }
    }

    // Hapus embeddings lama artikel sebelum mengisi yang baru
    await this.removeArticleEmbeddings(articleId)

    const fullContent = `${article.title}\n\n${article.contentMarkdown}`
    const chunks = chunkText(fullContent, { chunkSize: 500, chunkOverlap: 80 })

    if (chunks.length === 0) {
      return { articleId, chunksCount: 0, indexed: true }
    }

    const now = new Date().toISOString()
    const records: ArticleEmbeddingRecord[] = []

    for (const chunk of chunks) {
      const id = randomUUID()
      const embedding = await generateEmbedding(chunk)
      const record: ArticleEmbeddingRecord = {
        id,
        articleId,
        chunkText: chunk,
        embedding,
        createdAt: now,
      }
      records.push(record)
      memoryStore.embeddings.set(id, record)

      try {
        const vectorStr = formatVectorForPg(embedding)
        await sql`
          INSERT INTO article_embeddings (id, article_id, chunk_text, embedding, created_at)
          VALUES (${id}, ${articleId}, ${chunk}, ${vectorStr}::vector, ${now})
        `
      } catch {
        // Fallback to memoryStore
      }
    }

    return {
      articleId,
      chunksCount: records.length,
      indexed: true,
    }
  }

  /**
   * Mengambil semua embedding chunk milik suatu artikel
   */
  async getArticleEmbeddings(articleId: string): Promise<ArticleEmbeddingRecord[]> {
    try {
      const rows = await sql`
        SELECT
          id,
          article_id as "articleId",
          chunk_text as "chunkText",
          embedding,
          created_at as "createdAt"
        FROM article_embeddings
        WHERE article_id = ${articleId}
        ORDER BY created_at ASC
      `
      if (rows && rows.length > 0) {
        return rows as unknown as ArticleEmbeddingRecord[]
      }
    } catch {
      // Fallback to memoryStore
    }

    return Array.from(memoryStore.embeddings.values()).filter((e) => e.articleId === articleId)
  }

  /**
   * Menghapus seluruh embedding chunk milik suatu artikel
   */
  async removeArticleEmbeddings(articleId: string): Promise<void> {
    for (const [id, record] of memoryStore.embeddings.entries()) {
      if (record.articleId === articleId) {
        memoryStore.embeddings.delete(id)
      }
    }

    try {
      await sql`DELETE FROM article_embeddings WHERE article_id = ${articleId}`
    } catch {
      // Fallback to memoryStore
    }
  }

  /**
   * Query pencarian similaritas kosinus native PostgreSQL pgvector (<=> operator).
   * Otomatis fallback ke memory-based vector search bila db/pgvector tidak tersedia.
   */
  async searchSimilarArticles(
    query: string,
    options: { limit?: number; threshold?: number } = {},
  ): Promise<RagSearchResult[]> {
    const limit = options.limit ?? 5
    const threshold = options.threshold ?? 0.0

    const queryEmbedding = await generateEmbedding(query)
    const vectorStr = formatVectorForPg(queryEmbedding)

    try {
      // Operator <=> adalah cosine distance di pgvector
      // Cosine similarity = 1 - cosine_distance
      const rows = await sql`
        SELECT
          ae.article_id as "articleId",
          ae.chunk_text as "chunkText",
          pa.title as "title",
          pa.slug as "slug",
          (1 - (ae.embedding <=> ${vectorStr}::vector)) as "similarity"
        FROM article_embeddings ae
        JOIN portal_articles pa ON ae.article_id = pa.id
        WHERE pa.status = 'published'
          AND (1 - (ae.embedding <=> ${vectorStr}::vector)) >= ${threshold}
        ORDER BY ae.embedding <=> ${vectorStr}::vector ASC
        LIMIT ${limit}
      `
      if (rows && rows.length > 0) {
        return (
          rows as Array<{
            articleId: string
            title: string
            slug: string
            chunkText: string
            similarity: number | string
          }>
        ).map((r) => ({
          articleId: r.articleId,
          title: r.title,
          slug: r.slug,
          chunkText: r.chunkText,
          similarity: Number(r.similarity),
        }))
      }
    } catch {
      // Fallback to memoryStore
    }

    // In-memory calculation
    const allRecords = Array.from(memoryStore.embeddings.values())
    const scoredResults: RagSearchResult[] = []

    for (const record of allRecords) {
      const article = await helpCenterService.getArticleById(record.articleId)
      if (!article || article.status !== 'published') {
        continue
      }

      const similarity = cosineSimilarity(queryEmbedding, record.embedding)
      if (similarity >= threshold) {
        scoredResults.push({
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          chunkText: record.chunkText,
          similarity: Number(similarity.toFixed(4)),
        })
      }
    }

    scoredResults.sort((a, b) => b.similarity - a.similarity)
    return scoredResults.slice(0, limit)
  }

  /**
   * Melakukan reindex terhadap seluruh artikel Help Center yang berstatus 'published'
   */
  async reindexAllPublishedArticles(): Promise<{ totalArticles: number; totalChunks: number }> {
    const publishedArticles = await helpCenterService.listArticles({ status: 'published' })
    let totalChunks = 0

    for (const article of publishedArticles) {
      const result = await this.indexArticle(article.id)
      totalChunks += result.chunksCount
    }

    return {
      totalArticles: publishedArticles.length,
      totalChunks,
    }
  }
}

export const ragService = new RagService()
