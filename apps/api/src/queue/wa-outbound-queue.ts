import {
  BULLMQ_QUEUE_WA_OUTBOUND,
  BULLMQ_QUEUE_WA_OUTBOUND_DLQ,
  JOB_NAME_SEND_MESSAGE,
  type SendWaMessageJobPayload,
} from '@xatxoot/shared'
import { type JobsOptions, Queue, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'
import { config } from '../config'
import { sql } from '../db'
import { messageStore } from '../modules/messages/message-store'

export type WaOutboundJobData = SendWaMessageJobPayload

export interface DeadLetterJobRecord {
  jobId: string
  messageId: string
  reason: string
  failedAt: string
  data?: unknown
}

export interface WaOutboundJobResult {
  id?: string
  name: string
  data: WaOutboundJobData
  opts: JobsOptions
  attemptsMade: number
}

export const DEFAULT_OUTBOUND_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: true,
  removeOnFail: false,
}

export interface WaOutboundQueueOptions {
  mockMode?: boolean
  redisUrl?: string
}

export class WaOutboundQueueManager {
  private queue: Queue | null = null
  private dlqQueue: Queue | null = null
  private queueEvents: QueueEvents | null = null
  private redisConnection: IORedis | null = null
  private deadLetterStore: DeadLetterJobRecord[] = []
  private queuedJobs: WaOutboundJobResult[] = []
  private isClosed = false
  private mockMode: boolean

  constructor(options?: WaOutboundQueueOptions) {
    const isTest =
      process.env.NODE_ENV === 'test' ||
      process.env.BUN_ENV === 'test' ||
      (typeof process !== 'undefined' &&
        Array.isArray(process.argv) &&
        process.argv.some((a) => typeof a === 'string' && a.includes('test')))

    this.mockMode = options?.mockMode ?? isTest

    if (!this.mockMode) {
      this.initQueue(options?.redisUrl)
    }
  }

  private initQueue(customRedisUrl?: string): void {
    try {
      const redisUrl = customRedisUrl || config.REDIS_URL || 'redis://localhost:6379'
      this.redisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      })

      this.redisConnection.on('error', (err) => {
        console.warn('[WaOutboundQueue] Redis connection error:', (err as Error).message)
      })

      this.queue = new Queue(BULLMQ_QUEUE_WA_OUTBOUND, {
        connection: this.redisConnection,
      })

      this.dlqQueue = new Queue(BULLMQ_QUEUE_WA_OUTBOUND_DLQ, {
        connection: this.redisConnection,
      })

      this.queueEvents = new QueueEvents(BULLMQ_QUEUE_WA_OUTBOUND, {
        connection: this.redisConnection,
      })

      this.setupEventListeners()
    } catch (err) {
      console.warn('[WaOutboundQueue] Failed to initialize BullMQ queue:', (err as Error).message)
      this.mockMode = true
    }
  }

  private setupEventListeners(): void {
    if (!this.queueEvents) return

    this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      try {
        const res = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue
        if (res?.externalMessageId && this.queue) {
          const job = await this.queue.getJob(jobId)
          const messageId = job?.data?.messageId
          if (messageId) {
            await this.handleJobCompleted({
              messageId,
              externalMessageId: res.externalMessageId,
            })
          }
        }
      } catch (err) {
        console.warn('[WaOutboundQueue] Error handling completed event:', (err as Error).message)
      }
    })

    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      try {
        if (!this.queue) return
        const job = await this.queue.getJob(jobId)
        if (job) {
          const maxAttempts = job.opts.attempts ?? 3
          if (job.attemptsMade >= maxAttempts) {
            await this.handleJobFailed({
              jobId,
              messageId: job.data.messageId,
              attemptsMade: job.attemptsMade,
              error: new Error(failedReason || 'Job failed after max retries'),
              data: job.data,
            })
          }
        }
      } catch (err) {
        console.warn('[WaOutboundQueue] Error handling failed event:', (err as Error).message)
      }
    })
  }

  async addOutboundJob(
    data: WaOutboundJobData,
    opts?: Partial<JobsOptions>,
  ): Promise<WaOutboundJobResult> {
    const jobOptions: JobsOptions = {
      ...DEFAULT_OUTBOUND_JOB_OPTIONS,
      ...opts,
      jobId: data.jobId,
    }

    if (!this.mockMode && this.queue && !this.isClosed) {
      try {
        const bullJob = await this.queue.add(JOB_NAME_SEND_MESSAGE, data, jobOptions)
        const result: WaOutboundJobResult = {
          id: bullJob.id ?? data.jobId,
          name: JOB_NAME_SEND_MESSAGE,
          data,
          opts: jobOptions,
          attemptsMade: bullJob.attemptsMade ?? 0,
        }
        this.queuedJobs.push(result)
        return result
      } catch (err) {
        console.warn(
          '[WaOutboundQueue] BullMQ add failed, fallback to memory:',
          (err as Error).message,
        )
      }
    }

    const result: WaOutboundJobResult = {
      id: data.jobId,
      name: JOB_NAME_SEND_MESSAGE,
      data,
      opts: jobOptions,
      attemptsMade: 0,
    }
    this.queuedJobs.push(result)
    return result
  }

  async handleJobCompleted(params: {
    messageId: string
    externalMessageId: string
  }): Promise<void> {
    // 1. Update DB
    try {
      await sql`
        UPDATE messages
        SET external_source_id = ${params.externalMessageId}
        WHERE id = ${params.messageId}
      `
    } catch (err) {
      console.warn(
        '[WaOutboundQueue] Failed to update message on completed:',
        (err as Error).message,
      )
    }

    // 2. Update memory store
    const memMsg = messageStore.messages.get(params.messageId)
    if (memMsg) {
      memMsg.externalSourceId = params.externalMessageId
    }
  }

  async handleJobFailed(params: {
    jobId: string
    messageId: string
    attemptsMade: number
    error: Error
    data?: unknown
  }): Promise<void> {
    const errorMsg = params.error.message || 'Job execution failed'

    if (params.attemptsMade >= 3) {
      // 1. Record dead-letter job
      const dlqRecord: DeadLetterJobRecord = {
        jobId: params.jobId,
        messageId: params.messageId,
        reason: errorMsg,
        failedAt: new Date().toISOString(),
        data: params.data,
      }
      this.deadLetterStore.push(dlqRecord)

      // 2. Push to BullMQ DLQ queue if active
      if (!this.mockMode && this.dlqQueue && !this.isClosed) {
        try {
          await this.dlqQueue.add('dead-letter-job', dlqRecord, {
            jobId: `dlq_${params.jobId}`,
            removeOnComplete: false,
          })
        } catch {
          // Ignore DLQ queue push error
        }
      }

      // 3. Update database record: status = 'failed' & content_attributes.error
      try {
        const rows = await sql`
          SELECT content_attributes
          FROM messages
          WHERE id = ${params.messageId}
          LIMIT 1
        `

        let attrs: Record<string, unknown> = {}
        if (rows.length > 0 && rows[0].content_attributes) {
          const raw = rows[0].content_attributes
          if (typeof raw === 'object' && raw !== null) {
            attrs = { ...(raw as Record<string, unknown>) }
          } else if (typeof raw === 'string') {
            try {
              attrs = JSON.parse(raw)
            } catch {
              attrs = {}
            }
          }
        }
        attrs.error = errorMsg

        await sql`
          UPDATE messages
          SET status = 'failed',
              content_attributes = ${JSON.stringify(attrs)},
              updated_at = ${new Date().toISOString()}
          WHERE id = ${params.messageId}
        `
      } catch (err) {
        console.warn('[WaOutboundQueue] Failed to mark message as failed:', (err as Error).message)
      }

      // 4. Update memory store
      const memMsg = messageStore.messages.get(params.messageId)
      if (memMsg) {
        memMsg.status = 'failed'
        memMsg.contentAttributes = {
          ...memMsg.contentAttributes,
          error: errorMsg,
        }
      }
    }
  }

  async getDeadLetterJobs(): Promise<DeadLetterJobRecord[]> {
    return [...this.deadLetterStore]
  }

  getQueuedJobs(): WaOutboundJobResult[] {
    return [...this.queuedJobs]
  }

  reset(): void {
    this.deadLetterStore = []
    this.queuedJobs = []
  }

  async close(): Promise<void> {
    this.isClosed = true
    try {
      if (this.queueEvents) {
        await this.queueEvents.close()
      }
      if (this.queue) {
        await this.queue.close()
      }
      if (this.dlqQueue) {
        await this.dlqQueue.close()
      }
      if (this.redisConnection && this.redisConnection.status !== 'end') {
        this.redisConnection.disconnect()
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

export const waOutboundQueue = new WaOutboundQueueManager()
