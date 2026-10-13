import { Hono } from 'hono'
import { ragController } from './rag.controller'

export const ragRoutes = new Hono()

ragRoutes.post('/search', (c) => ragController.search(c))
ragRoutes.post('/index/:articleId', (c) => ragController.indexArticle(c))
ragRoutes.post('/reindex-all', (c) => ragController.reindexAll(c))
