import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { config } from '../../config'
import { storageService } from '../../services/storage.service'

export const mediaRoutes = new Hono()

// GET /api/v1/media/:filename/signed-url — Dapatkan pre-signed URL langsung untuk unduhan mandiri
mediaRoutes.get('/:filename/signed-url', async (c) => {
  const filename = c.req.param('filename')
  const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '')

  const exists = await storageService.fileExists(safeFilename)
  if (!exists) {
    return c.json({ error: 'Media not found' }, 404)
  }

  const expiresIn = Number(c.req.query('expiresIn')) || 3600
  const signedUrl = await storageService.getSignedUrl(safeFilename, expiresIn)

  return c.json({ signedUrl, filename: safeFilename, expiresIn })
})

// GET /api/v1/media/:filename — Streaming proxy langsung dari S3 / MinIO atau 302 redirect jika signed=true
mediaRoutes.get('/:filename', async (c) => {
  const filename = c.req.param('filename')
  // Prevent directory traversal
  const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '')

  // 1. Jika query signed=true diminta, redirect (302) ke pre-signed URL S3/MinIO
  if (c.req.query('signed') === 'true') {
    const exists = await storageService.fileExists(safeFilename)
    if (!exists) {
      return c.json({ error: 'Media not found' }, 404)
    }
    const signedUrl = await storageService.getSignedUrl(safeFilename)
    return c.redirect(signedUrl, 302)
  }

  // 2. Ambil file dari Object Storage (S3 / MinIO) dan lakukan streaming langsung
  const storageFile = await storageService.getFile(safeFilename)
  if (storageFile) {
    return new Response(storageFile.buffer, {
      headers: {
        'Content-Type': storageFile.mimeType || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // 3. Fallback ke folder media terisolasi lokal jika dikonfigurasi via MEDIA_DIR
  if (config.MEDIA_DIR) {
    const filePath = join(config.MEDIA_DIR, safeFilename)
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
