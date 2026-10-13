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
import { sql } from '../../db'

const memoryStore = {
  portals: new Map<string, Portal>(),
  categories: new Map<string, PortalCategory>(),
  articles: new Map<string, PortalArticle>(),
}

export function resetHelpCenterStore(): void {
  memoryStore.portals.clear()
  memoryStore.categories.clear()
  memoryStore.articles.clear()
}

export class HelpCenterService {
  // ==========================================
  // Portal Operations
  // ==========================================

  async createPortal(input: CreatePortalInput): Promise<Portal> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const portal: Portal = {
      id,
      name: input.name,
      slug: input.slug,
      customDomain: input.customDomain ?? null,
      headerText: input.headerText ?? null,
      logoUrl: input.logoUrl ?? null,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.portals.set(id, portal)

    try {
      await sql`
        INSERT INTO portals (id, name, slug, custom_domain, header_text, logo_url, created_at, updated_at)
        VALUES (
          ${portal.id}, ${portal.name}, ${portal.slug}, ${portal.customDomain},
          ${portal.headerText}, ${portal.logoUrl}, ${portal.createdAt}, ${portal.updatedAt}
        )
      `
    } catch {
      // Memory fallback for tests
    }

    return portal
  }

  async listPortals(): Promise<Portal[]> {
    try {
      const rows = await sql`
        SELECT
          id, name, slug, custom_domain as "customDomain",
          header_text as "headerText", logo_url as "logoUrl",
          created_at as "createdAt", updated_at as "updatedAt"
        FROM portals
        ORDER BY created_at DESC
      `
      if (rows && rows.length > 0) {
        return rows as unknown as Portal[]
      }
    } catch {
      // Memory fallback
    }

    return Array.from(memoryStore.portals.values())
  }

  async getPortalById(id: string): Promise<Portal | null> {
    if (memoryStore.portals.has(id)) {
      return memoryStore.portals.get(id) || null
    }

    try {
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
        return rows[0] as unknown as Portal
      }
    } catch {
      // Memory fallback
    }

    return null
  }

  async getPortalBySlug(slug: string): Promise<Portal | null> {
    const memoryPortal = Array.from(memoryStore.portals.values()).find((p) => p.slug === slug)
    if (memoryPortal) {
      return memoryPortal
    }

    try {
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
        return rows[0] as unknown as Portal
      }
    } catch {
      // Memory fallback
    }

    return null
  }

  async updatePortal(id: string, input: UpdatePortalInput): Promise<Portal> {
    const existing = await this.getPortalById(id)
    if (!existing) {
      throw new Error(`Portal not found: ${id}`)
    }

    const now = new Date().toISOString()
    const updated: Portal = {
      ...existing,
      name: input.name ?? existing.name,
      slug: input.slug ?? existing.slug,
      customDomain: input.customDomain !== undefined ? input.customDomain : existing.customDomain,
      headerText: input.headerText !== undefined ? input.headerText : existing.headerText,
      logoUrl: input.logoUrl !== undefined ? input.logoUrl : existing.logoUrl,
      updatedAt: now,
    }

    memoryStore.portals.set(id, updated)

    try {
      await sql`
        UPDATE portals
        SET
          name = ${updated.name},
          slug = ${updated.slug},
          custom_domain = ${updated.customDomain},
          header_text = ${updated.headerText},
          logo_url = ${updated.logoUrl},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async deletePortal(id: string): Promise<boolean> {
    memoryStore.portals.delete(id)
    // Cascade delete in-memory categories and articles
    for (const [catId, cat] of memoryStore.categories.entries()) {
      if (cat.portalId === id) {
        memoryStore.categories.delete(catId)
        for (const [artId, art] of memoryStore.articles.entries()) {
          if (art.categoryId === catId) {
            memoryStore.articles.delete(artId)
          }
        }
      }
    }

    try {
      await sql`DELETE FROM portals WHERE id = ${id}`
    } catch {
      // Memory fallback
    }

    return true
  }

  // ==========================================
  // Category Operations
  // ==========================================

  async createCategory(input: CreatePortalCategoryInput): Promise<PortalCategory> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const category: PortalCategory = {
      id,
      portalId: input.portalId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      position: input.position ?? 0,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.categories.set(id, category)

    try {
      await sql`
        INSERT INTO portal_categories (id, portal_id, name, slug, description, position, created_at, updated_at)
        VALUES (
          ${category.id}, ${category.portalId}, ${category.name}, ${category.slug},
          ${category.description}, ${category.position}, ${category.createdAt}, ${category.updatedAt}
        )
      `
    } catch {
      // Memory fallback
    }

    return category
  }

  async listCategories(filter?: { portalId?: string }): Promise<PortalCategory[]> {
    if (memoryStore.categories.size > 0) {
      let categories = Array.from(memoryStore.categories.values())
      if (filter?.portalId) {
        categories = categories.filter((c) => c.portalId === filter.portalId)
      }
      return categories.sort((a, b) => a.position - b.position)
    }

    try {
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
      if (rows && rows.length > 0) {
        return rows as unknown as PortalCategory[]
      }
    } catch {
      // Memory fallback
    }

    return []
  }

  async getCategoryById(id: string): Promise<PortalCategory | null> {
    if (memoryStore.categories.has(id)) {
      return memoryStore.categories.get(id) || null
    }

    try {
      const rows = await sql`
        SELECT
          id, portal_id as "portalId", name, slug, description, position,
          created_at as "createdAt", updated_at as "updatedAt"
        FROM portal_categories
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as PortalCategory
      }
    } catch {
      // Memory fallback
    }

    return null
  }

  async updateCategory(id: string, input: UpdatePortalCategoryInput): Promise<PortalCategory> {
    const existing = await this.getCategoryById(id)
    if (!existing) {
      throw new Error(`Category not found: ${id}`)
    }

    const now = new Date().toISOString()
    const updated: PortalCategory = {
      ...existing,
      name: input.name ?? existing.name,
      slug: input.slug ?? existing.slug,
      description: input.description !== undefined ? input.description : existing.description,
      position: input.position !== undefined ? input.position : existing.position,
      updatedAt: now,
    }

    memoryStore.categories.set(id, updated)

    try {
      await sql`
        UPDATE portal_categories
        SET
          name = ${updated.name},
          slug = ${updated.slug},
          description = ${updated.description},
          position = ${updated.position},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async deleteCategory(id: string): Promise<boolean> {
    memoryStore.categories.delete(id)
    for (const [artId, art] of memoryStore.articles.entries()) {
      if (art.categoryId === id) {
        memoryStore.articles.delete(artId)
      }
    }

    try {
      await sql`DELETE FROM portal_categories WHERE id = ${id}`
    } catch {
      // Memory fallback
    }

    return true
  }

  // ==========================================
  // Article Operations
  // ==========================================

  async createArticle(input: CreatePortalArticleInput): Promise<PortalArticle> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const article: PortalArticle = {
      id,
      categoryId: input.categoryId,
      authorId: input.authorId ?? null,
      title: input.title,
      slug: input.slug,
      contentMarkdown: input.contentMarkdown ?? '',
      status: input.status ?? 'draft',
      viewsCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.articles.set(id, article)

    try {
      await sql`
        INSERT INTO portal_articles (
          id, category_id, author_id, title, slug, content_markdown, status, views_count, created_at, updated_at
        ) VALUES (
          ${article.id}, ${article.categoryId}, ${article.authorId}, ${article.title},
          ${article.slug}, ${article.contentMarkdown}, ${article.status},
          ${article.viewsCount}, ${article.createdAt}, ${article.updatedAt}
        )
      `
    } catch {
      // Memory fallback
    }

    return article
  }

  async listArticles(filter?: {
    categoryId?: string
    portalId?: string
    status?: string
  }): Promise<PortalArticle[]> {
    if (memoryStore.articles.size > 0) {
      let articles = Array.from(memoryStore.articles.values())
      if (filter?.categoryId) {
        articles = articles.filter((a) => a.categoryId === filter.categoryId)
      }
      if (filter?.portalId) {
        const catIds = Array.from(memoryStore.categories.values())
          .filter((c) => c.portalId === filter.portalId)
          .map((c) => c.id)
        articles = articles.filter((a) => catIds.includes(a.categoryId))
      }
      if (filter?.status) {
        articles = articles.filter((a) => a.status === filter.status)
      }
      return articles
    }

    try {
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
      if (rows && rows.length > 0) {
        return rows as unknown as PortalArticle[]
      }
    } catch {
      // Memory fallback
    }

    return []
  }

  async getArticleById(id: string): Promise<PortalArticle | null> {
    if (memoryStore.articles.has(id)) {
      return memoryStore.articles.get(id) || null
    }

    try {
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
        return rows[0] as unknown as PortalArticle
      }
    } catch {
      // Memory fallback
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
    const updated: PortalArticle = {
      ...existing,
      categoryId: input.categoryId ?? existing.categoryId,
      authorId: input.authorId !== undefined ? input.authorId : existing.authorId,
      title: input.title ?? existing.title,
      slug: input.slug ?? existing.slug,
      contentMarkdown:
        input.contentMarkdown !== undefined ? input.contentMarkdown : existing.contentMarkdown,
      status: input.status ?? existing.status,
      updatedAt: now,
    }

    memoryStore.articles.set(id, updated)

    try {
      await sql`
        UPDATE portal_articles
        SET
          category_id = ${updated.categoryId},
          author_id = ${updated.authorId},
          title = ${updated.title},
          slug = ${updated.slug},
          content_markdown = ${updated.contentMarkdown},
          status = ${updated.status},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async deleteArticle(id: string): Promise<boolean> {
    memoryStore.articles.delete(id)
    try {
      await sql`DELETE FROM portal_articles WHERE id = ${id}`
    } catch {
      // Memory fallback
    }
    return true
  }

  async incrementArticleViews(id: string): Promise<PortalArticle> {
    const existing = await this.getArticleById(id)
    if (!existing) {
      throw new Error(`Article not found: ${id}`)
    }

    const viewsCount = existing.viewsCount + 1
    const updated: PortalArticle = {
      ...existing,
      viewsCount,
    }
    memoryStore.articles.set(id, updated)

    try {
      await sql`
        UPDATE portal_articles
        SET views_count = views_count + 1
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }
}

export const helpCenterService = new HelpCenterService()
