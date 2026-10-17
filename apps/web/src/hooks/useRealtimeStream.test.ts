import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { MessageCreatedEvent, MessageStatusUpdatedEvent, TicketUpdatedEvent } from './types'
import {
  RealtimeStreamClient,
  applyRealtimeMessage,
  applyRealtimeMessageStatus,
  applyRealtimeTicket,
  createRealtimeUrl,
  useRealtimeStream,
} from './useRealtimeStream'

type MockListener = (event: { type: string; data: string }) => void

// Mock EventSource implementation for testing SSE stream
class MockEventSource {
  public url: string
  public readyState = 0 // CONNECTING
  public listeners: Record<string, MockListener[]> = {}
  public onopen: (() => void) | null = null
  public onerror: ((err: unknown) => void) | null = null
  public onmessage: MockListener | null = null
  public closed = false

  static instances: MockEventSource[] = []

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: MockListener) {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }
    this.listeners[type].push(listener)
  }

  removeEventListener(type: string, listener: MockListener) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener)
    }
  }

  dispatchEvent(type: string, data: unknown) {
    const event = { type, data: typeof data === 'string' ? data : JSON.stringify(data) }
    const eventListeners = this.listeners[type] || []
    for (const listener of eventListeners) {
      listener(event)
    }
    if (type === 'message' && this.onmessage) {
      this.onmessage(event)
    }
  }

  simulateOpen() {
    this.readyState = 1 // OPEN
    if (this.onopen) {
      this.onopen()
    }
  }

  simulateError(error: unknown = new Error('SSE connection failed')) {
    this.readyState = 2 // CLOSED
    if (this.onerror) {
      this.onerror(error)
    }
  }

  close() {
    this.closed = true
    this.readyState = 2 // CLOSED
  }
}

describe('SSE Real-time Stream Hook & Client (Task 1.28 - apps/web)', () => {
  let originalEventSource: typeof globalThis.EventSource | undefined

  beforeEach(() => {
    MockEventSource.instances = []
    originalEventSource = globalThis.EventSource
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource as unknown as typeof EventSource
  })

  describe('createRealtimeUrl', () => {
    it('should build proper SSE stream URL with token query param', () => {
      const url = createRealtimeUrl({
        baseUrl: 'http://localhost:3000',
        token: 'test-jwt-token-123',
      })
      expect(url).toBe('http://localhost:3000/api/v1/realtime/stream?token=test-jwt-token-123')
    })

    it('should default to /api/v1/realtime/stream without query when token is empty', () => {
      const url = createRealtimeUrl()
      expect(url).toBe('/api/v1/realtime/stream')
    })
  })

  describe('RealtimeStreamClient Connection Lifecycle', () => {
    it('should initialize connection in connecting state and switch to connected on handshake', () => {
      const client = new RealtimeStreamClient({
        token: 'mock-token',
        autoConnect: false,
      })

      expect(client.getStatus()).toBe('disconnected')

      client.connect()
      expect(client.getStatus()).toBe('connecting')
      expect(MockEventSource.instances.length).toBe(1)

      const mockEs = MockEventSource.instances[0]
      mockEs.simulateOpen()
      mockEs.dispatchEvent('connected', { status: 'connected', user: { id: 'usr-1' } })

      expect(client.getStatus()).toBe('connected')

      client.disconnect()
      expect(client.getStatus()).toBe('disconnected')
      expect(mockEs.closed).toBe(true)
    })

    it('should transition to error state when connection fails', () => {
      const onError = mock()
      const client = new RealtimeStreamClient({
        token: 'mock-token',
        autoConnect: true,
        onError,
      })

      const mockEs = MockEventSource.instances[0]
      mockEs.simulateError()

      expect(client.getStatus()).toBe('error')
      expect(onError).toHaveBeenCalled()
      client.disconnect()
    })
  })

  describe('RealtimeStreamClient Event Dispatching', () => {
    it('should handle message.created event and invoke callback', () => {
      const onMessageCreated = mock()
      const client = new RealtimeStreamClient({
        token: 'mock-token',
        autoConnect: true,
        onMessageCreated,
      })

      const mockEs = MockEventSource.instances[0]
      mockEs.simulateOpen()

      const payload: MessageCreatedEvent = {
        id: 'msg-999',
        conversationId: 'conv-1',
        content: 'Halo kak, barang sudah sampai!',
        messageType: 'incoming',
        contentType: 'text',
        createdAt: '2026-10-11T12:00:00Z',
      }

      mockEs.dispatchEvent('message.created', payload)
      expect(onMessageCreated).toHaveBeenCalledWith(payload)
      client.disconnect()
    })

    it('should handle message.status_updated event and invoke callback', () => {
      const onMessageStatusUpdated = mock()
      const client = new RealtimeStreamClient({
        token: 'mock-token',
        autoConnect: true,
        onMessageStatusUpdated,
      })

      const mockEs = MockEventSource.instances[0]
      mockEs.simulateOpen()

      const payload: MessageStatusUpdatedEvent = {
        id: 'msg-999',
        conversationId: 'conv-1',
        status: 'read',
        updatedAt: '2026-10-11T12:01:00Z',
      }

      mockEs.dispatchEvent('message.status_updated', payload)
      expect(onMessageStatusUpdated).toHaveBeenCalledWith(payload)
      client.disconnect()
    })

    it('should handle ticket.updated event and invoke callback', () => {
      const onTicketUpdated = mock()
      const client = new RealtimeStreamClient({
        token: 'mock-token',
        autoConnect: true,
        onTicketUpdated,
      })

      const mockEs = MockEventSource.instances[0]
      mockEs.simulateOpen()

      const payload: TicketUpdatedEvent = {
        id: 't-101',
        ticketNumber: 'T-101',
        status: 'resolved',
        assignedTo: 'usr-agent-01',
        internalNote: 'Masalah pengiriman telah diselesaikan kurir.',
        updatedAt: '2026-10-11T12:05:00Z',
      }

      mockEs.dispatchEvent('ticket.updated', payload)
      expect(onTicketUpdated).toHaveBeenCalledWith(payload)
      client.disconnect()
    })

    it('should allow custom event subscriptions via on / off methods', () => {
      const customListener = mock()
      const client = new RealtimeStreamClient({
        token: 'mock-token',
        autoConnect: true,
      })

      const unsubscribe = client.on('custom.event', customListener)
      const mockEs = MockEventSource.instances[0]

      mockEs.dispatchEvent('custom.event', { foo: 'bar' })
      expect(customListener).toHaveBeenCalledWith({ foo: 'bar' })

      unsubscribe()
      mockEs.dispatchEvent('custom.event', { foo: 'baz' })
      expect(customListener).toHaveBeenCalledTimes(1)
      client.disconnect()
    })
  })

  describe('useRealtimeStream Hook Export Contract', () => {
    it('should export useRealtimeStream hook with connect, disconnect, and status', () => {
      expect(typeof useRealtimeStream).toBe('function')
    })
  })

  describe('Realtime State Updaters', () => {
    it('should append new incoming message and deduplicate by id', () => {
      const currentMap: Record<
        string,
        Array<{
          id: string
          conversationId: string
          senderType: string
          content: string
          timestamp: string
          dateGroup: string
        }>
      > = {
        'conv-1': [
          {
            id: 'm-1',
            conversationId: 'conv-1',
            senderType: 'user',
            content: 'Halo',
            timestamp: '10:00',
            dateGroup: 'HARI INI',
          },
        ],
      }

      const event: MessageCreatedEvent = {
        id: 'm-2',
        conversationId: 'conv-1',
        content: 'Halo juga kak',
        messageType: 'incoming',
        contentType: 'text',
        createdAt: '2026-10-11T10:01:00Z',
      }

      const updated = applyRealtimeMessage(currentMap, event)
      expect(updated['conv-1'].length).toBe(2)
      expect(updated['conv-1'][1].id).toBe('m-2')
      expect(updated['conv-1'][1].content).toBe('Halo juga kak')

      // Test deduplication
      const duplicate = applyRealtimeMessage(updated, event)
      expect(duplicate['conv-1'].length).toBe(2)
    })

    it('should update message delivery status in conversations', () => {
      const currentMap: Record<
        string,
        Array<{
          id: string
          conversationId: string
          senderType: string
          content: string
          timestamp: string
          dateGroup: string
          status?: string
        }>
      > = {
        'conv-1': [
          {
            id: 'm-1',
            conversationId: 'conv-1',
            senderType: 'user',
            content: 'Halo kak',
            timestamp: '10:00',
            dateGroup: 'HARI INI',
            status: 'sent',
          },
        ],
      }

      const updated = applyRealtimeMessageStatus(currentMap, {
        id: 'm-1',
        conversationId: 'conv-1',
        status: 'read',
        updatedAt: '2026-10-11T10:02:00Z',
      })

      expect(updated['conv-1'][0].status).toBe('read')
    })

    it('should update ticket status in conversation list', () => {
      const conversations = [
        {
          id: 'conv-1',
          contactName: 'Budi',
          channel: 'whatsapp',
          ticket: {
            id: 't-1',
            ticketNumber: 'T-001',
            status: 'open',
            priority: 'high',
            assignedTo: undefined as string | undefined,
          },
        },
      ]

      const updated = applyRealtimeTicket(conversations, {
        id: 't-1',
        ticketNumber: 'T-001',
        status: 'resolved',
        assignedTo: 'agent-1',
        updatedAt: '2026-10-11T10:05:00Z',
      })

      expect(updated[0].ticket?.status).toBe('resolved')
      expect(updated[0].ticket?.assignedTo).toBe('agent-1')
    })

    it('should normalize inbound contact message with messageType text to incoming', () => {
      const currentMap: Record<
        string,
        Array<{
          id: string
          conversationId: string
          messageType?: string
          senderType?: string
          ticketId?: string
          ticketDisplayId?: string
          timestamp?: string
        }>
      > = {
        'conv-1': [],
      }

      const event: MessageCreatedEvent = {
        id: 'msg-wa-1',
        conversationId: 'conv-1',
        ticketId: 't-123',
        ticketDisplayId: '1001',
        content: 'apakah ini masuk?',
        messageType: 'text',
        contentType: 'text',
        senderId: 'contact-1',
        senderType: 'contact',
        senderName: 'Wardi',
        createdAt: '2026-10-17T07:24:50.593Z',
        timestamp: '2026-10-17T07:24:50.593Z',
      }

      const updated = applyRealtimeMessage(currentMap, event)
      const appended = updated['conv-1'][0]

      expect(appended).toBeDefined()
      expect(appended.id).toBe('msg-wa-1')
      expect(appended.messageType).toBe('incoming')
      expect(appended.senderType).toBe('contact')
      expect(appended.ticketId).toBe('t-123')
      expect(appended.ticketDisplayId).toBe('1001')
      expect(appended.timestamp).not.toContain('T')
    })
  })
})
