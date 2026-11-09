import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Hono } from 'hono'
import { storageService } from '../../services/storage.service'
import { mediaRoutes } from './media.routes'

describe('Media Routes - S3 / MinIO Object Storage Proxy & Pre-Signed URLs (Issue #318 - TDD RED)', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/api/v1/media', mediaRoutes)
    storageService.resetMock()
  })

  it('must strictly NOT contain relative path traversal to wa-gateway in production code', () => {
    const routeFilePath = resolve(import.meta.dir, 'media.routes.ts')
    const fileContent = readFileSync(routeFilePath, 'utf-8')

    // Acceptance criteria: Tidak ada lagi pembacaan relative path lintas folder microservices ('../wa-gateway/data/media')
    expect(fileContent).not.toContain('../wa-gateway/data/media')
    expect(fileContent).not.toContain('apps/wa-gateway/data/media')
  })

  it('should stream media file from S3 object storage (GET /api/v1/media/:filename)', async () => {
    const filename = 'avatar_123.jpg'
    const content = Buffer.from('binary-image-data-test')
    await storageService.uploadFile(filename, content, 'image/jpeg')

    const res = await app.request(`/api/v1/media/${filename}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    const body = await res.arrayBuffer()
    expect(Buffer.from(body).toString()).toBe('binary-image-data-test')
  })

  it('should return 404 when requested media does not exist in object storage', async () => {
    const res = await app.request('/api/v1/media/non-existent-media-999.png')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Media not found')
  })

  it('should redirect (302) to pre-signed URL when signed=true query parameter is present', async () => {
    const filename = 'contract_sample.pdf'
    await storageService.uploadFile(filename, Buffer.from('pdf-data'), 'application/pdf')

    const res = await app.request(`/api/v1/media/${filename}?signed=true`)
    expect(res.status).toBe(302)
    const location = res.headers.get('location')
    expect(location).toBeDefined()
    expect(location).toContain(filename)
  })

  it('should return pre-signed URL JSON payload on GET /api/v1/media/:filename/signed-url', async () => {
    const filename = 'recording.ogg'
    await storageService.uploadFile(filename, Buffer.from('audio-bytes'), 'audio/ogg')

    const res = await app.request(`/api/v1/media/${filename}/signed-url`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.signedUrl).toBeDefined()
    expect(data.signedUrl).toContain(filename)
  })
})
