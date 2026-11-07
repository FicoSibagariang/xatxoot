import type {
  CreatePortalArticleInput,
  CreatePortalCategoryInput,
  CreatePortalInput,
  Portal,
  PortalArticle,
  PortalCategory,
  UpdatePortalArticleInput,
  UpdatePortalCategoryInput,
  UpdatePortalInput,
} from '@xatxoot/shared'
import { sql, toIsoString } from '../../db'

function mapPortalRow(row: Record<string, unknown>): Portal {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    customDomain: (row.customDomain as string | null) ?? null,
    headerText: (row.headerText as string | null) ?? null,
    logoUrl: (row.logoUrl as string | null) ?? null,
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

function mapCategoryRow(row: Record<string, unknown>): PortalCategory {
  return {
    id: String(row.id),
    portalId: String(row.portalId),
    name: String(row.name),
    slug: String(row.slug),
    description: (row.description as string | null) ?? null,
    position: Number(row.position ?? 0),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

function mapArticleRow(row: Record<string, unknown>): PortalArticle {
  return {
    id: String(row.id),
    categoryId: String(row.categoryId),
    authorId: (row.authorId as string | null) ?? null,
    title: String(row.title),
    slug: String(row.slug),
    contentMarkdown: (row.contentMarkdown as string) ?? '',
    status: row.status as PortalArticle['status'],
    viewsCount: Number(row.viewsCount ?? 0),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

export async function resetHelpCenterStore(): Promise<void> {
  await sql`DELETE FROM portal_articles`
  await sql`DELETE FROM portal_categories`
  await sql`DELETE FROM portals`
}

export class HelpCenterService {
  // ==========================================
  // Portal Operations
  // ==========================================

  async createPortal(input: CreatePortalInput): Promise<Portal> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const customDomain = input.customDomain ?? null
    const headerText = input.headerText ?? null
    const logoUrl = input.logoUrl ?? null

    const rows = await sql`
      INSERT INTO portals (id, name, slug, custom_domain, header_text, logo_url, created_at, updated_at)
      VALUES (
        ${id}, ${input.name}, ${input.slug}, ${customDomain},
        ${headerText}, ${logoUrl}, ${now}, ${now}
      )
      RETURNING
        id, name, slug, custom_domain as "customDomain",
        header_text as "headerText", logo_url as "logoUrl",
        created_at as "createdAt", updated_at as "updatedAt"
    `

    return mapPortalRow(rows[0])
  }

  async listPortals(): Promise<Portal[]> {
    const rows = await sql`
      SELECT
        id, name, slug, custom_domain as "customDomain",
        header_text as "headerText", logo_url as "logoUrl",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM portals
      ORDER BY created_at DESC
    `
    return (rows || []).map(mapPortalRow)
  }

  async getPortalById(id: string): Promise<Portal | null> {
    const rows = await sql`
      SELECT
        id, name, slug, custom_domain as "customDomain",
        header_text as "headerText", logo_url as "logoUrl",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM portals
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapPortalRow(rows[0])
    }

    return null
  }

  async getPortalBySlug(slug: string): Promise<Portal | null> {
    const rows = await sql`
      SELECT
        id, name, slug, custom_domain as "customDomain",
        header_text as "headerText", logo_url as "logoUrl",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM portals
      WHERE slug = ${slug}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapPortalRow(rows[0])
    }

    return null
  }

  async updatePortal(id: string, input: UpdatePortalInput): Promise<Portal> {
    const existing = await this.getPortalById(id)
    if (!existing) {
      throw new Error(`Portal not found: ${id}`)
    }

    const now = new Date().toISOString()
    const name = input.name ?? existing.name
    const slug = input.slug ?? existing.slug
    const customDomain =
      input.customDomain !== undefined ? input.customDomain : existing.customDomain
    const headerText = input.headerText !== undefined ? input.headerText : existing.headerText
    const logoUrl = input.logoUrl !== undefined ? input.logoUrl : existing.logoUrl

    const rows = await sql`
      UPDATE portals
      SET
        name = ${name},
        slug = ${slug},
        custom_domain = ${customDomain},
        header_text = ${headerText},
        logo_url = ${logoUrl},
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id, name, slug, custom_domain as "customDomain",
        header_text as "headerText", logo_url as "logoUrl",
        created_at as "createdAt", updated_at as "updatedAt"
    `

    return mapPortalRow(rows[0])
  }

  async deletePortal(id: string): Promise<boolean> {
    const rows = await sql`DELETE FROM portals WHERE id = ${id} RETURNING id`
    return rows.length > 0
  }

  // ==========================================
  // Category Operations
  // ==========================================

  async createCategory(input: CreatePortalCategoryInput): Promise<PortalCategory> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const description = input.description ?? null
    const position = input.position ?? 0

    const rows = await sql`
      INSERT INTO portal_categories (id, portal_id, name, slug, description, position, created_at, updated_at)
      VALUES (
        ${id}, ${input.portalId}, ${input.name}, ${input.slug},
        ${description}, ${position}, ${now}, ${now}
      )
      RETURNING
        id, portal_id as "portalId", name, slug, description, position,
        created_at as "createdAt", updated_at as "updatedAt"
    `

    return mapCategoryRow(rows[0])
  }

  async listCategories(filter?: { portalId?: string }): Promise<PortalCategory[]> {
    let query = sql`
      SELECT
        id, portal_id as "portalId", name, slug, description, position,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM portal_categories
      WHERE 1 = 1
    `
    if (filter?.portalId) {
      query = sql`${query} AND portal_id = ${filter.portalId}`
    }
    query = sql`${query} ORDER BY position ASC, created_at ASC`
    const rows = await query
    return (rows || []).map(mapCategoryRow)
  }

  async getCategoryById(id: string): Promise<PortalCategory | null> {
    const rows = await sql`
      SELECT
        id, portal_id as "portalId", name, slug, description, position,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM portal_categories
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapCategoryRow(rows[0])
    }

    return null
  }

  async updateCategory(id: string, input: UpdatePortalCategoryInput): Promise<PortalCategory> {
    const existing = await this.getCategoryById(id)
    if (!existing) {
      throw new Error(`Category not found: ${id}`)
    }

    const now = new Date().toISOString()
    const name = input.name ?? existing.name
    const slug = input.slug ?? existing.slug
    const description = input.description !== undefined ? input.description : existing.description
    const position = input.position !== undefined ? input.position : existing.position

    const rows = await sql`
      UPDATE portal_categories
      SET
        name = ${name},
        slug = ${slug},
        description = ${description},
        position = ${position},
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id, portal_id as "portalId", name, slug, description, position,
        created_at as "createdAt", updated_at as "updatedAt"
    `

    return mapCategoryRow(rows[0])
  }

  async deleteCategory(id: string): Promise<boolean> {
    const rows = await sql`DELETE FROM portal_categories WHERE id = ${id} RETURNING id`
    return rows.length > 0
  }

  // ==========================================
  // Article Operations
  // ==========================================

  async createArticle(input: CreatePortalArticleInput): Promise<PortalArticle> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const authorId = input.authorId ?? null
    const contentMarkdown = input.contentMarkdown ?? ''
    const status = input.status ?? 'draft'
    const viewsCount = 0

    const rows = await sql`
      INSERT INTO portal_articles (
        id, category_id, author_id, title, slug, content_markdown, status, views_count, created_at, updated_at
      ) VALUES (
        ${id}, ${input.categoryId}, ${authorId}, ${input.title},
        ${input.slug}, ${contentMarkdown}, ${status},
        ${viewsCount}, ${now}, ${now}
      )
      RETURNING
        id, category_id as "categoryId", author_id as "authorId",
        title, slug, content_markdown as "contentMarkdown",
        status, views_count as "viewsCount",
        created_at as "createdAt", updated_at as "updatedAt"
    `

    return mapArticleRow(rows[0])
  }

  async listArticles(filter?: {
    categoryId?: string
    portalId?: string
    status?: string
  }): Promise<PortalArticle[]> {
    let query = sql`
      SELECT
        a.id, a.category_id as "categoryId", a.author_id as "authorId",
        a.title, a.slug, a.content_markdown as "contentMarkdown",
        a.status, a.views_count as "viewsCount",
        a.created_at as "createdAt", a.updated_at as "updatedAt"
      FROM portal_articles a
      JOIN portal_categories c ON a.category_id = c.id
      WHERE 1 = 1
    `
    if (filter?.categoryId) {
      query = sql`${query} AND a.category_id = ${filter.categoryId}`
    }
    if (filter?.portalId) {
      query = sql`${query} AND c.portal_id = ${filter.portalId}`
    }
    if (filter?.status) {
      query = sql`${query} AND a.status = ${filter.status}`
    }
    query = sql`${query} ORDER BY a.created_at DESC`
    const rows = await query
    return (rows || []).map(mapArticleRow)
  }

  async getArticleById(id: string): Promise<PortalArticle | null> {
    const rows = await sql`
      SELECT
        id, category_id as "categoryId", author_id as "authorId",
        title, slug, content_markdown as "contentMarkdown",
        status, views_count as "viewsCount",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM portal_articles
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapArticleRow(rows[0])
    }

    return null
  }

  async getArticleBySlug(
    portalSlug: string,
    articleSlug: string,
  ): Promise<{
    article: PortalArticle
    portal: Portal
    category: PortalCategory
  } | null> {
    const portal = await this.getPortalBySlug(portalSlug)
    if (!portal) return null

    const categories = await this.listCategories({ portalId: portal.id })
    const catMap = new Map(categories.map((c) => [c.id, c]))

    const articles = await this.listArticles({ portalId: portal.id })
    const article = articles.find((a) => a.slug === articleSlug)
    if (!article) return null

    const category = catMap.get(article.categoryId)
    if (!category) return null

    return { article, portal, category }
  }

  async updateArticle(id: string, input: UpdatePortalArticleInput): Promise<PortalArticle> {
    const existing = await this.getArticleById(id)
    if (!existing) {
      throw new Error(`Article not found: ${id}`)
    }

    const now = new Date().toISOString()
    const categoryId = input.categoryId ?? existing.categoryId
    const authorId = input.authorId !== undefined ? input.authorId : existing.authorId
    const title = input.title ?? existing.title
    const slug = input.slug ?? existing.slug
    const contentMarkdown =
      input.contentMarkdown !== undefined ? input.contentMarkdown : existing.contentMarkdown
    const status = input.status ?? existing.status

    const rows = await sql`
      UPDATE portal_articles
      SET
        category_id = ${categoryId},
        author_id = ${authorId},
        title = ${title},
        slug = ${slug},
        content_markdown = ${contentMarkdown},
        status = ${status},
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id, category_id as "categoryId", author_id as "authorId",
        title, slug, content_markdown as "contentMarkdown",
        status, views_count as "viewsCount",
        created_at as "createdAt", updated_at as "updatedAt"
    `

    return mapArticleRow(rows[0])
  }

  async deleteArticle(id: string): Promise<boolean> {
    const rows = await sql`DELETE FROM portal_articles WHERE id = ${id} RETURNING id`
    return rows.length > 0
  }

  async incrementArticleViews(id: string): Promise<PortalArticle> {
    const rows = await sql`
      UPDATE portal_articles
      SET views_count = views_count + 1, updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id, category_id as "categoryId", author_id as "authorId",
        title, slug, content_markdown as "contentMarkdown",
        status, views_count as "viewsCount",
        created_at as "createdAt", updated_at as "updatedAt"
    `
    if (!rows || rows.length === 0) {
      throw new Error(`Article not found: ${id}`)
    }

    return mapArticleRow(rows[0])
  }
}

export const helpCenterService = new HelpCenterService()
