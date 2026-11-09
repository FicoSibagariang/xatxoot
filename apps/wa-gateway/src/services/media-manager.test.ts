import { describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStorageService } from '@xatxoot/shared'
import { MediaManager } from './media-manager'

describe('WhatsApp Gateway - Media Manager (TDD RED)', () => {
  const testMediaDir = join(tmpdir(), `xatxoot-test-media-${process.pid}`)

  it('should extract extension and filename for image/jpeg', () => {
    const manager = new MediaManager({ mediaDir: testMediaDir })
    const filename = manager.generateFilename('session_01', 'msg_123', 'image/jpeg')
    expect(filename).toBe('session_01_msg_123.jpg')
  })

  it('should generate valid relative and absolute media URLs', () => {
    const manager = new MediaManager({ mediaDir: testMediaDir })
    const url = manager.getMediaUrl('session_01_msg_123.jpg')
    expect(url).toBe('/api/v1/media/session_01_msg_123.jpg')
  })

  it('should save media buffer to object storage and return media metadata', async () => {
    const mockStorage = createStorageService({ useMock: true })
    const manager = new MediaManager({
      mediaDir: testMediaDir,
      storageService: mockStorage,
    })
    const sampleBuffer = Buffer.from('fake-jpeg-data')
    const result = await manager.saveMediaBuffer(
      sampleBuffer,
      'session_01',
      'msg_456',
      'image/jpeg',
    )

    expect(result).not.toBeNull()
    expect(result?.filename).toBe('session_01_msg_456.jpg')
    expect(result?.mimeType).toBe('image/jpeg')
    expect(result?.mediaUrl).toBe('/api/v1/media/session_01_msg_456.jpg')
    expect(result?.fileSize).toBe(sampleBuffer.length)

    // Verify object storage received the file
    const exists = await mockStorage.fileExists('session_01_msg_456.jpg')
    expect(exists).toBe(true)

    const storedFile = await mockStorage.getFile('session_01_msg_456.jpg')
    expect(storedFile?.buffer.toString()).toBe('fake-jpeg-data')
  })
})
