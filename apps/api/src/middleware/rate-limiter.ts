import type { Context, MiddlewareHandler } from 'hono'

export interface RateLimitOptions {
  windowMs?: number
  max?: number
  message?: string
  onlyFailedAttempts?: boolean
  keyGenerator?: (c: Context) => string
}

interface ClientBucket {
  timestamps: number[]
}

const rateLimitStore = new Map<string, ClientBucket>()

export function resetRateLimiter(): void {
  rateLimitStore.clear()
}

export function rateLimiter(options: RateLimitOptions = {}): MiddlewareHandler {
  const windowMs = options.windowMs ?? 60_000
  const max = options.max ?? 5
  const message = options.message ?? 'Terlalu banyak permintaan. Silakan coba lagi nanti.'
  const onlyFailedAttempts = options.onlyFailedAttempts ?? false

  const defaultKeyGenerator = (c: Context): string => {
    const forwarded = c.req.header('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    const realIp = c.req.header('x-real-ip')
    if (realIp) {
      return realIp.trim()
    }
    return '127.0.0.1'
  }

  const keyGen = options.keyGenerator || defaultKeyGenerator

  return async (c: Context, next) => {
    const now = Date.now()
    const clientKey = keyGen(c)

    let bucket = rateLimitStore.get(clientKey)
    if (!bucket) {
      bucket = { timestamps: [] }
      rateLimitStore.set(clientKey, bucket)
    }

    // Filter out timestamps outside the active sliding window
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs)

    if (bucket.timestamps.length >= max) {
      const oldest = bucket.timestamps[0]
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
      const resetTime = Math.ceil((oldest + windowMs) / 1000)

      c.header('Retry-After', String(retryAfterSeconds))
      c.header('X-RateLimit-Limit', String(max))
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', String(resetTime))

      return c.json(
        {
          error: 'Too Many Requests',
          message,
        },
        429,
      )
    }

    bucket.timestamps.push(now)
    const remaining = Math.max(0, max - bucket.timestamps.length)
    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(remaining))

    await next()

    // If onlyFailedAttempts is enabled and response was successful (< 400), don't count towards rate limit
    if (onlyFailedAttempts && c.res.status < 400) {
      const idx = bucket.timestamps.indexOf(now)
      if (idx !== -1) {
        bucket.timestamps.splice(idx, 1)
      }
    }
  }
}
