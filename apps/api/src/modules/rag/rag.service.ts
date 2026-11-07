import { randomUUID } from 'node:crypto'
import { sql, toIsoString } from '../../db'
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

function mapEmbeddingRow(row: Record<string, unknown>): ArticleEmbeddingRecord {
  return {
    id: String(row.id),
    articleId: String(row.articleId),
    chunkText: String(row.chunkText),
    embedding:
      typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : (row.embedding as number[]) || [],
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
  }
}

export async function resetRagStore(): Promise<void> {
  await sql`DELETE FROM article_embeddings`
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
    let chunksCount = 0

    for (const chunk of chunks) {
      const id = randomUUID()
      const embedding = await generateEmbedding(chunk)
      const vectorStr = formatVectorForPg(embedding)
      await sql`
        INSERT INTO article_embeddings (id, article_id, chunk_text, embedding, created_at)
        VALUES (${id}, ${articleId}, ${chunk}, ${vectorStr}::vector, ${now})
      `
      chunksCount++
    }

    return {
      articleId,
      chunksCount,
      indexed: true,
    }
  }

  /**
   * Mengambil semua embedding chunk milik suatu artikel
   */
  async getArticleEmbeddings(articleId: string): Promise<ArticleEmbeddingRecord[]> {
    const rows = await sql`
      SELECT
        id,
        article_id as "articleId",
        chunk_text as "chunkText",
        embedding::text as "embedding",
        created_at as "createdAt"
      FROM article_embeddings
      WHERE article_id = ${articleId}
      ORDER BY created_at ASC
    `
    return (rows || []).map(mapEmbeddingRow)
  }

  /**
   * Menghapus seluruh embedding chunk milik suatu artikel
   */
  async removeArticleEmbeddings(articleId: string): Promise<void> {
    await sql`DELETE FROM article_embeddings WHERE article_id = ${articleId}`
  }

  /**
   * Query pencarian similaritas kosinus native PostgreSQL pgvector (<=> operator).
   */
  async searchSimilarArticles(
    query: string,
    options: { limit?: number; threshold?: number } = {},
  ): Promise<RagSearchResult[]> {
    const limit = options.limit ?? 5
    const threshold = options.threshold ?? 0.0

    const queryEmbedding = await generateEmbedding(query)
    const vectorStr = formatVectorForPg(queryEmbedding)

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

    return ((rows || []) as unknown as Record<string, unknown>[]).map((r) => ({
      articleId: String(r.articleId),
      title: String(r.title),
      slug: String(r.slug),
      chunkText: String(r.chunkText),
      similarity: Number(Number(r.similarity).toFixed(4)),
    }))
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
