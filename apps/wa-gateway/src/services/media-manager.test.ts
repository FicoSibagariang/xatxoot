import { describe, expect, it, mock } from 'bun:test'
import { MediaManager } from './media-manager'

describe('WhatsApp Gateway - Media Manager (TDD RED)', () => {
  it('should extract extension and filename for image/jpeg', () => {
    const manager = new MediaManager({ mediaDir: '/tmp/test-media' })
    const filename = manager.generateFilename('session_01', 'msg_123', 'image/jpeg')
    expect(filename).toBe('session_01_msg_123.jpg')
  })

  it('should generate valid relative and absolute media URLs', () => {
    const manager = new MediaManager({ mediaDir: '/tmp/test-media' })
    const url = manager.getMediaUrl('session_01_msg_123.jpg')
    expect(url).toBe('/api/v1/media/session_01_msg_123.jpg')
  })

  it('should save media buffer and return media metadata', async () => {
    const manager = new MediaManager({ mediaDir: '/tmp/test-media' })
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
  })
})
