import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  BULLMQ_QUEUE_WA_OUTBOUND,
  BULLMQ_QUEUE_WA_OUTBOUND_DLQ,
  JOB_NAME_SEND_MESSAGE,
  SendWaMessageJobPayloadSchema,
} from '@xatxoot/shared'
import { sql } from '../../db'
import {
  type WaOutboundJobData,
  WaOutboundQueueManager,
  waOutboundQueue,
} from '../../queue/wa-outbound-queue'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { MessageService, resetMessageStore } from './messages.service'

describe('BullMQ WhatsApp Outbound Queue & Dead-Letter Queue (Issue #317 - TDD RED)', () => {
  let messageService: MessageService
  let testInboxId: string
  let testChannelId: string
  let testConvId: string

  beforeEach(async () => {
    resetMessageStore()
    messageService = new MessageService()

    const { inbox, channel } = await inboxService.createInbox({
      name: 'Unofficial BullMQ Test Inbox',
      channelType: 'whatsapp_unofficial',
      channel: {
        sessionId: 'session_queue_test_01',
        phoneNumber: '+6281234445566',
      },
    })
    testInboxId = inbox.id
    testChannelId = channel.id

    const inbound = await conversationService.handleInboundMessage({
      inboxId: testInboxId,
      sourceId: '+6289988776655',
      senderPhone: '+6289988776655',
      senderName: 'Customer Queue Test',
      content: 'Halo CS, mohon info resi pengiriman',
    })
    testConvId = inbound.conversation.id
  })

  afterEach(async () => {
    await waOutboundQueue.close()
  })

  describe('Constants & Shared Schemas', () => {
    it('should export correct BullMQ queue names and job identifiers', () => {
      expect(BULLMQ_QUEUE_WA_OUTBOUND).toBe('wa-outbound')
      expect(BULLMQ_QUEUE_WA_OUTBOUND_DLQ).toBe('wa-outbound-dlq')
      expect(JOB_NAME_SEND_MESSAGE).toBe('send-message')
    })

    it('should validate SendWaMessageJobPayloadSchema', () => {
      const validPayload = {
        jobId: '11111111-1111-4111-a111-111111111111',
        messageId: '22222222-2222-4222-a222-222222222222',
        channelId: testChannelId,
        sessionId: 'session_queue_test_01',
        recipientNumber: '6289988776655',
        messageType: 'text' as const,
        text: 'Nomor resi Anda adalah JNE-123456789',
      }
      const parsed = SendWaMessageJobPayloadSchema.safeParse(validPayload)
      expect(parsed.success).toBe(true)
    })
  })

  describe('BullMQ Outbound Queue Producer Configuration', () => {
    it('should configure job with 3 attempts, exponential backoff (1000ms), and removeOnComplete: true', async () => {
      const jobData: WaOutboundJobData = {
        jobId: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        channelId: testChannelId,
        sessionId: 'session_queue_test_01',
        recipientNumber: '6289988776655',
        messageType: 'text',
        text: 'Testing retry & backoff opts',
      }

      const job = await waOutboundQueue.addOutboundJob(jobData)
      expect(job).toBeDefined()
      expect(job.opts.attempts).toBe(3)
      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 1000,
      })
      expect(job.opts.removeOnComplete).toBe(true)
    })

    it('should decouple direct HTTP fetch and route outbound messages strictly via BullMQ queue', async () => {
      const originalFetch = globalThis.fetch
      let fetchCalled = false
      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = String(input)
        if (urlStr.includes('/api/messages/send')) {
          fetchCalled = true
        }
        return originalFetch(input, init)
      }) as typeof fetch

      try {
        const result = await messageService.sendMessage({
          conversationId: testConvId,
          content: 'Pesan tanpa coupling HTTP direct fetch',
          senderType: 'user',
        })

        expect(result.message).toBeDefined()
        expect(fetchCalled).toBe(false)

        const queuedJobs = messageService.getQueuedBaileysJobs()
        expect(queuedJobs.length).toBeGreaterThan(0)
        const lastJob = queuedJobs[queuedJobs.length - 1]
        expect(lastJob.queue).toBe(BULLMQ_QUEUE_WA_OUTBOUND)
        expect(lastJob.name).toBe(JOB_NAME_SEND_MESSAGE)
        expect(lastJob.data.text).toBe('Pesan tanpa coupling HTTP direct fetch')
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('Outbound Message Lifecycle & Dead-Letter Queue (DLQ)', () => {
    it('should update message external_source_id upon successful job dispatch', async () => {
      const sendResult = await messageService.sendMessage({
        conversationId: testConvId,
        content: 'Pesan akan terkirim dengan ID eksternal',
        senderType: 'user',
      })
      const messageId = sendResult.message.id

      // Simulate completion event from BullMQ worker
      await waOutboundQueue.handleJobCompleted({
        messageId,
        externalMessageId: 'WAM_EXT_SUCCESS_9999',
      })

      // Verify in DB
      const [updated] = await sql`
        SELECT external_source_id, status
        FROM messages
        WHERE id = ${messageId}
      `
      expect(updated.external_source_id).toBe('WAM_EXT_SUCCESS_9999')
    })

    it('should transition message status to failed and record error in contentAttributes when job exhausts retries (DLQ)', async () => {
      const sendResult = await messageService.sendMessage({
        conversationId: testConvId,
        content: 'Pesan yang gagal setelah 3x retry',
        senderType: 'user',
      })
      const messageId = sendResult.message.id

      // Simulate failure exhausting attempts (attemptsMade = 3 >= attempts = 3)
      await waOutboundQueue.handleJobFailed({
        jobId: crypto.randomUUID(),
        messageId,
        attemptsMade: 3,
        error: new Error('Baileys connection socket timed out after 3 retries'),
      })

      // Verify in DB: status must be 'failed' and content_attributes must contain error
      const [failedMsg] = await sql`
        SELECT status, content_attributes
        FROM messages
        WHERE id = ${messageId}
      `
      expect(failedMsg.status).toBe('failed')
      const attrs =
        typeof failedMsg.content_attributes === 'string'
          ? JSON.parse(failedMsg.content_attributes)
          : failedMsg.content_attributes
      expect(attrs.error).toBeDefined()
      expect(String(attrs.error)).toContain('Baileys connection socket timed out after 3 retries')

      // Verify DLQ queue or DLQ log entry is created
      const dlqEntries = await waOutboundQueue.getDeadLetterJobs()
      const foundInDlq = dlqEntries.find((d) => d.messageId === messageId)
      expect(foundInDlq).toBeDefined()
      expect(foundInDlq?.reason).toContain('Baileys connection socket timed out')
    })
  })
})
