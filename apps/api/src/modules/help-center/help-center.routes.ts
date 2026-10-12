import { Hono } from 'hono'
import { helpCenterController } from './help-center.controller'

// 1. Public SSR Routes
export const publicPortalRoutes = new Hono()

publicPortalRoutes.get('/:slug', (c) => helpCenterController.renderPortalHomepage(c))
publicPortalRoutes.get('/:slug/articles/:article_slug', (c) =>
  helpCenterController.renderArticlePage(c),
)

// 2. Portals Management API Routes
export const portalRoutes = new Hono()

portalRoutes.get('/', (c) => helpCenterController.listPortals(c))
portalRoutes.post('/', (c) => helpCenterController.createPortal(c))
portalRoutes.get('/:id', (c) => helpCenterController.getPortal(c))
portalRoutes.patch('/:id', (c) => helpCenterController.updatePortal(c))
portalRoutes.delete('/:id', (c) => helpCenterController.deletePortal(c))

// 3. Categories Management API Routes
export const categoryRoutes = new Hono()

categoryRoutes.get('/', (c) => helpCenterController.listCategories(c))
categoryRoutes.post('/', (c) => helpCenterController.createCategory(c))
categoryRoutes.get('/:id', (c) => helpCenterController.getCategory(c))
categoryRoutes.patch('/:id', (c) => helpCenterController.updateCategory(c))
categoryRoutes.delete('/:id', (c) => helpCenterController.deleteCategory(c))

// 4. Articles Management API Routes
export const articleRoutes = new Hono()

articleRoutes.get('/', (c) => helpCenterController.listArticles(c))
articleRoutes.post('/', (c) => helpCenterController.createArticle(c))
articleRoutes.get('/:id', (c) => helpCenterController.getArticle(c))
articleRoutes.patch('/:id', (c) => helpCenterController.updateArticle(c))
articleRoutes.delete('/:id', (c) => helpCenterController.deleteArticle(c))
