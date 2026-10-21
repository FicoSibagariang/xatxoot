import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Hono } from 'hono'

export const mediaRoutes = new Hono()

const MEDIA_DIRS = [
  process.env.MEDIA_DIR,
  resolve(process.cwd(), 'data/media'),
  resolve(process.cwd(), '../data/media'),
  resolve(process.cwd(), '../../data/media'),
  resolve(process.cwd(), 'apps/wa-gateway/data/media'),
  resolve(process.cwd(), '../wa-gateway/data/media'),
  resolve(process.cwd(), '../../apps/wa-gateway/data/media'),
  resolve(process.cwd(), './apps/api/data/media'),
].filter(Boolean) as string[]

mediaRoutes.get('/:filename', async (c) => {
  const filename = c.req.param('filename')
  // Prevent directory traversal
  const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '')

  for (const dir of MEDIA_DIRS) {
    const filePath = join(dir, safeFilename)
    if (existsSync(filePath)) {
      const file = Bun.file(filePath)
      return new Response(file, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }
  }

  return c.json({ error: 'Media not found' }, 404)
})
