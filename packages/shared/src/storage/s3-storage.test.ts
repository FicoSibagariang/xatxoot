import { beforeEach, describe, expect, it } from 'bun:test'
import { type S3StorageConfig, S3StorageService, createStorageService } from './index'

describe('Centralized S3 / MinIO Object Storage Service (Issue #318 - TDD RED)', () => {
  let storage: S3StorageService

  beforeEach(() => {
    storage = createStorageService({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      forcePathStyle: true,
      useMock: true,
    })
  })

  it('should initialize with configuration options', () => {
    const config: S3StorageConfig = {
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      forcePathStyle: true,
    }
    const service = new S3StorageService(config)
    expect(service.bucket).toBe('test-bucket')
    expect(service.endpoint).toBe('http://localhost:9000')
  })

  it('should upload file buffer and retrieve it from storage', async () => {
    const key = 'test-file.jpg'
    const buffer = Buffer.from('fake-image-bytes-123')
    const mimeType = 'image/jpeg'

    const uploadResult = await storage.uploadFile(key, buffer, mimeType)
    expect(uploadResult.key).toBe(key)
    expect(uploadResult.size).toBe(buffer.length)
    expect(uploadResult.url).toBeDefined()

    const retrieved = await storage.getFile(key)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.mimeType).toBe(mimeType)
    expect(retrieved?.buffer.toString()).toBe('fake-image-bytes-123')
  })

  it('should check if file exists and return false for non-existent file', async () => {
    const key = 'existing-file.png'
    await storage.uploadFile(key, Buffer.from('png-data'), 'image/png')

    const exists = await storage.fileExists(key)
    expect(exists).toBe(true)

    const notExists = await storage.fileExists('non-existent.png')
    expect(notExists).toBe(false)
  })

  it('should generate pre-signed URL for direct download', async () => {
    const key = 'document.pdf'
    await storage.uploadFile(key, Buffer.from('pdf-content'), 'application/pdf')

    const signedUrl = await storage.getSignedUrl(key, 3600)
    expect(signedUrl).toBeDefined()
    expect(signedUrl).toContain(key)
  })

  it('should delete file from storage', async () => {
    const key = 'to-delete.txt'
    await storage.uploadFile(key, Buffer.from('delete-me'), 'text/plain')
    expect(await storage.fileExists(key)).toBe(true)

    await storage.deleteFile(key)
    expect(await storage.fileExists(key)).toBe(false)
    expect(await storage.getFile(key)).toBeNull()
  })
})
