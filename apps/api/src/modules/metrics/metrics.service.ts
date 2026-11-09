import { realtimeService } from '../realtime/realtime.service'

const HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

export class MetricsRegistry {
  private requestCounts = new Map<string, number>()
  private durationBuckets = new Map<number, number>()
  private durationSum = 0
  private durationCount = 0
  private errorCounts = new Map<string, number>()
  private dbQueryDurations: number[] = []

  constructor() {
    this.initBuckets()
  }

  private initBuckets(): void {
    for (const b of HISTOGRAM_BUCKETS) {
      this.durationBuckets.set(b, 0)
    }
  }

  reset(): void {
    this.requestCounts.clear()
    this.durationBuckets.clear()
    this.initBuckets()
    this.durationSum = 0
    this.durationCount = 0
    this.errorCounts.clear()
    this.dbQueryDurations = []
  }

  recordHttpRequest(method: string, path: string, status: number, durationSeconds: number): void {
    // 1. Total requests counter
    // Normalize path to prevent high cardinality: replace UUIDs and numbers
    const normalizedPath = path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+/g, '/:id')
    const key = `method="${method}",path="${normalizedPath}",status="${status}"`
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1)

    // 2. Duration histogram
    this.durationCount++
    this.durationSum += durationSeconds
    for (const b of HISTOGRAM_BUCKETS) {
      if (durationSeconds <= b) {
        this.durationBuckets.set(b, (this.durationBuckets.get(b) || 0) + 1)
      }
    }

    // 3. Error rate counter
    if (status >= 400 && status < 500) {
      const errKey = 'status_class="4xx"'
      this.errorCounts.set(errKey, (this.errorCounts.get(errKey) || 0) + 1)
    } else if (status >= 500) {
      const errKey = 'status_class="5xx"'
      this.errorCounts.set(errKey, (this.errorCounts.get(errKey) || 0) + 1)
    }
  }

  recordDbQuery(durationSeconds: number): void {
    this.dbQueryDurations.push(durationSeconds)
    // Keep max 1000 items in sliding window
    if (this.dbQueryDurations.length > 1000) {
      this.dbQueryDurations.shift()
    }
  }

  getQuantile(quantile: number): number {
    if (this.dbQueryDurations.length === 0) return 0.001
    const sorted = [...this.dbQueryDurations].sort((a, b) => a - b)
    const index = Math.ceil(quantile * sorted.length) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }

  async generateMetrics(): Promise<string> {
    const lines: string[] = []

    // 1. Process metrics
    lines.push('# HELP process_uptime_seconds The process uptime in seconds.')
    lines.push('# TYPE process_uptime_seconds gauge')
    lines.push(`process_uptime_seconds ${process.uptime().toFixed(3)}`)

    const mem = process.memoryUsage()
    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.')
    lines.push('# TYPE process_resident_memory_bytes gauge')
    lines.push(`process_resident_memory_bytes ${mem.rss}`)

    lines.push('# HELP nodejs_heap_size_total_bytes Total size of heap in bytes.')
    lines.push('# TYPE nodejs_heap_size_total_bytes gauge')
    lines.push(`nodejs_heap_size_total_bytes ${mem.heapTotal}`)

    lines.push('# HELP nodejs_heap_size_used_bytes Used heap size in bytes.')
    lines.push('# TYPE nodejs_heap_size_used_bytes gauge')
    lines.push(`nodejs_heap_size_used_bytes ${mem.heapUsed}`)

    // 2. HTTP Requests Counter
    lines.push('# HELP http_requests_total Total number of HTTP requests made.')
    lines.push('# TYPE http_requests_total counter')
    if (this.requestCounts.size === 0) {
      lines.push('http_requests_total{method="GET",path="/health",status="200"} 0')
    } else {
      for (const [labels, count] of this.requestCounts.entries()) {
        lines.push(`http_requests_total{${labels}} ${count}`)
      }
    }

    // 3. HTTP Request Duration Histogram
    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds.')
    lines.push('# TYPE http_request_duration_seconds histogram')
    let cumulative = 0
    for (const b of HISTOGRAM_BUCKETS) {
      cumulative = this.durationBuckets.get(b) || cumulative
      lines.push(`http_request_duration_seconds_bucket{le="${b}"} ${cumulative}`)
    }
    lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${this.durationCount}`)
    lines.push(`http_request_duration_seconds_sum ${this.durationSum.toFixed(6)}`)
    lines.push(`http_request_duration_seconds_count ${this.durationCount}`)

    // 4. HTTP Errors Counter
    lines.push('# HELP http_requests_errors_total Total number of HTTP 4xx/5xx errors.')
    lines.push('# TYPE http_requests_errors_total counter')
    lines.push(
      `http_requests_errors_total{status_class="4xx"} ${this.errorCounts.get('status_class="4xx"') || 0}`,
    )
    lines.push(
      `http_requests_errors_total{status_class="5xx"} ${this.errorCounts.get('status_class="5xx"') || 0}`,
    )

    // 5. Active SSE Connections Gauge
    const sseCount = realtimeService.getActiveConnectionCount()
    lines.push(
      '# HELP sse_active_connections Number of currently active Server-Sent Events (SSE) connections.',
    )
    lines.push('# TYPE sse_active_connections gauge')
    lines.push(`sse_active_connections ${sseCount}`)

    // 6. DB Query Duration Percentiles
    const p95 = this.getQuantile(0.95)
    const p99 = this.getQuantile(0.99)
    lines.push('# HELP db_query_duration_seconds Database query duration percentiles.')
    lines.push('# TYPE db_query_duration_seconds gauge')
    lines.push(`db_query_duration_seconds{quantile="0.95"} ${p95.toFixed(6)}`)
    lines.push(`db_query_duration_seconds{quantile="0.99"} ${p99.toFixed(6)}`)

    return `${lines.join('\n')}\n`
  }
}

export const metricsRegistry = new MetricsRegistry()
