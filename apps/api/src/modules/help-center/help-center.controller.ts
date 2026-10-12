import {
  CreatePortalArticleInputSchema,
  CreatePortalCategoryInputSchema,
  CreatePortalInputSchema,
  UpdatePortalArticleInputSchema,
  UpdatePortalCategoryInputSchema,
  UpdatePortalInputSchema,
} from '@xatxoot/shared'
import type { Context } from 'hono'
import { html } from 'hono/html'
import { helpCenterService } from './help-center.service'

export class HelpCenterController {
  // ==========================================
  // Management API: Portals
  // ==========================================

  async createPortal(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = CreatePortalInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
          400,
        )
      }
      const portal = await helpCenterService.createPortal(parsed.data)
      return c.json({ success: true, data: portal }, 201)
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async listPortals(c: Context) {
    const data = await helpCenterService.listPortals()
    return c.json({ success: true, data })
  }

  async getPortal(c: Context) {
    const id = c.req.param('id')
    const portal = await helpCenterService.getPortalById(id)
    if (!portal) {
      return c.json({ success: false, error: 'Portal not found' }, 404)
    }
    return c.json({ success: true, data: portal })
  }

  async updatePortal(c: Context) {
    try {
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = UpdatePortalInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
          400,
        )
      }
      const updated = await helpCenterService.updatePortal(id, parsed.data)
      return c.json({ success: true, data: updated })
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async deletePortal(c: Context) {
    const id = c.req.param('id')
    await helpCenterService.deletePortal(id)
    return c.json({ success: true, message: 'Portal deleted' })
  }

  // ==========================================
  // Management API: Categories
  // ==========================================

  async createCategory(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = CreatePortalCategoryInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
          400,
        )
      }
      const category = await helpCenterService.createCategory(parsed.data)
      return c.json({ success: true, data: category }, 201)
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async listCategories(c: Context) {
    const portalId = c.req.query('portalId')
    const data = await helpCenterService.listCategories(portalId ? { portalId } : undefined)
    return c.json({ success: true, data })
  }

  async getCategory(c: Context) {
    const id = c.req.param('id')
    const category = await helpCenterService.getCategoryById(id)
    if (!category) {
      return c.json({ success: false, error: 'Category not found' }, 404)
    }
    return c.json({ success: true, data: category })
  }

  async updateCategory(c: Context) {
    try {
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = UpdatePortalCategoryInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
          400,
        )
      }
      const updated = await helpCenterService.updateCategory(id, parsed.data)
      return c.json({ success: true, data: updated })
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async deleteCategory(c: Context) {
    const id = c.req.param('id')
    await helpCenterService.deleteCategory(id)
    return c.json({ success: true, message: 'Category deleted' })
  }

  // ==========================================
  // Management API: Articles
  // ==========================================

  async createArticle(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = CreatePortalArticleInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
          400,
        )
      }
      const article = await helpCenterService.createArticle(parsed.data)
      return c.json({ success: true, data: article }, 201)
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async listArticles(c: Context) {
    const categoryId = c.req.query('categoryId')
    const portalId = c.req.query('portalId')
    const status = c.req.query('status')
    const data = await helpCenterService.listArticles({
      categoryId: categoryId || undefined,
      portalId: portalId || undefined,
      status: status || undefined,
    })
    return c.json({ success: true, data })
  }

  async getArticle(c: Context) {
    const id = c.req.param('id')
    const article = await helpCenterService.getArticleById(id)
    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404)
    }
    return c.json({ success: true, data: article })
  }

  async updateArticle(c: Context) {
    try {
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = UpdatePortalArticleInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
          400,
        )
      }
      const updated = await helpCenterService.updateArticle(id, parsed.data)
      return c.json({ success: true, data: updated })
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async deleteArticle(c: Context) {
    const id = c.req.param('id')
    await helpCenterService.deleteArticle(id)
    return c.json({ success: true, message: 'Article deleted' })
  }

  // ==========================================
  // Public SSR Routes (Hono HTML Renderer)
  // ==========================================

  async renderPortalHomepage(c: Context) {
    const slug = c.req.param('slug')
    const portal = await helpCenterService.getPortalBySlug(slug)

    if (!portal) {
      return c.html(
        html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Portal Tidak Ditemukan - Xatxoot</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; color: #111b21; margin: 0; padding: 40px; text-align: center; }
    .card { background: white; max-width: 500px; margin: 60px auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    h1 { color: #ea4335; font-size: 24px; margin-bottom: 12px; }
    p { color: #667781; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Portal Tidak Ditemukan</h1>
    <p>Maaf, portal bantuan dengan alamat ini tidak tersedia atau telah dipindahkan.</p>
  </div>
</body>
</html>`,
        404,
      )
    }

    const categories = await helpCenterService.listCategories({ portalId: portal.id })
    const publishedArticles = await helpCenterService.listArticles({
      portalId: portal.id,
      status: 'published',
    })

    const articlesByCat = new Map<string, typeof publishedArticles>()
    for (const cat of categories) {
      articlesByCat.set(
        cat.id,
        publishedArticles.filter((a) => a.categoryId === cat.id),
      )
    }

    const renderedCategories = categories.map((cat) => {
      const articles = articlesByCat.get(cat.id) || []
      return html`
        <div class="category-card">
          <h2 class="category-title">${cat.name}</h2>
          ${cat.description ? html`<p class="category-desc">${cat.description}</p>` : ''}
          <ul class="article-list">
            ${
              articles.length > 0
                ? articles.map(
                    (art) => html`
                  <li>
                    <a href="/portal/${portal.slug}/articles/${art.slug}" class="article-link">
                      ${art.title}
                    </a>
                  </li>
                `,
                  )
                : html`<li class="empty-notice">Belum ada artikel di kategori ini.</li>`
            }
          </ul>
        </div>
      `
    })

    return c.html(
      html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${portal.name} - Pusat Bantuan</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { --primary: #00a884; --bg: #f0f2f5; --card-bg: #ffffff; --text: #111b21; --subtext: #667781; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 0; }
    header { background: var(--primary); color: white; padding: 48px 24px; text-align: center; }
    header h1 { margin: 0 0 12px; font-size: 32px; font-weight: 700; }
    header p { margin: 0; font-size: 18px; opacity: 0.95; }
    main { max-width: 960px; margin: 40px auto; padding: 0 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
    .category-card { background: var(--card-bg); padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .category-title { margin: 0 0 8px; font-size: 20px; color: var(--primary); }
    .category-desc { margin: 0 0 16px; font-size: 14px; color: var(--subtext); }
    .article-list { list-style: none; padding: 0; margin: 0; }
    .article-list li { margin-bottom: 10px; }
    .article-link { color: var(--text); text-decoration: none; font-size: 15px; transition: color 0.15s; }
    .article-link:hover { color: var(--primary); text-decoration: underline; }
    .empty-notice { color: var(--subtext); font-size: 13px; font-style: italic; }
  </style>
</head>
<body>
  <header>
    <h1>${portal.name}</h1>
    ${portal.headerText ? html`<p>${portal.headerText}</p>` : ''}
  </header>
  <main>
    <div class="grid">
      ${renderedCategories}
    </div>
  </main>
</body>
</html>`,
    )
  }

  async renderArticlePage(c: Context) {
    const portalSlug = c.req.param('slug')
    const articleSlug = c.req.param('article_slug')

    const data = await helpCenterService.getArticleBySlug(portalSlug, articleSlug)
    if (!data || data.article.status !== 'published') {
      return c.html(
        html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Artikel Tidak Ditemukan - Xatxoot</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #111b21; margin: 0; padding: 40px; text-align: center; }
    .card { background: white; max-width: 500px; margin: 60px auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    h1 { color: #ea4335; font-size: 24px; margin-bottom: 12px; }
    p { color: #667781; font-size: 15px; }
    a { color: #00a884; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Artikel Tidak Ditemukan</h1>
    <p>Artikel yang Anda cari tidak tersedia atau belum dipublikasikan.</p>
    <p><a href="/portal/${portalSlug}">Kembali ke Pusat Bantuan</a></p>
  </div>
</body>
</html>`,
        404,
      )
    }

    const { article, portal, category } = data
    // Increment views count
    await helpCenterService.incrementArticleViews(article.id)

    return c.html(
      html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${article.title} - ${portal.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { --primary: #00a884; --bg: #f0f2f5; --card-bg: #ffffff; --text: #111b21; --subtext: #667781; --border: #e9edef; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 0; }
    nav { background: white; border-bottom: 1px solid var(--border); padding: 16px 24px; }
    .nav-container { max-width: 800px; margin: 0 auto; display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .nav-container a { color: var(--primary); text-decoration: none; font-weight: 500; }
    .nav-sep { color: var(--subtext); }
    main { max-width: 800px; margin: 32px auto; padding: 0 20px; }
    .article-card { background: var(--card-bg); padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    h1 { font-size: 28px; margin: 0 0 16px; color: var(--text); }
    .meta { font-size: 13px; color: var(--subtext); margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .content { font-size: 16px; line-height: 1.7; color: #202c33; white-space: pre-wrap; }
  </style>
</head>
<body>
  <nav>
    <div class="nav-container">
      <a href="/portal/${portal.slug}">${portal.name}</a>
      <span class="nav-sep">/</span>
      <span>${category.name}</span>
    </div>
  </nav>
  <main>
    <article class="article-card">
      <h1>${article.title}</h1>
      <div class="meta">
        <span>Kategori: <strong>${category.name}</strong></span> &bull; 
        <span>Dilihat: <strong>${article.viewsCount + 1}x</strong></span>
      </div>
      <div class="content">${article.contentMarkdown}</div>
    </article>
  </main>
</body>
</html>`,
    )
  }
}

export const helpCenterController = new HelpCenterController()
