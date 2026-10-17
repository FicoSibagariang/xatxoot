export class OutboundTracker {
  private recentIds = new Map<string, number>()
  private ttlMs = 10 * 60 * 1000 // 10 minutes retention

  track(messageId: string): void {
    if (!messageId) return
    this.cleanup()
    this.recentIds.set(messageId, Date.now())
  }

  isRecent(messageId: string): boolean {
    if (!messageId) return false
    this.cleanup()
    return this.recentIds.has(messageId)
  }

  consume(messageId: string): boolean {
    if (!messageId) return false
    this.cleanup()
    if (this.recentIds.has(messageId)) {
      this.recentIds.delete(messageId)
      return true
    }
    return false
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [id, time] of this.recentIds.entries()) {
      if (now - time > this.ttlMs) {
        this.recentIds.delete(id)
      }
    }
  }

  clear(): void {
    this.recentIds.clear()
  }
}

export const outboundTracker = new OutboundTracker()
