import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { AsyncEventQueue, type RealtimeEvent, realtimeService } from '../realtime/realtime.service'

export async function handleWidgetSendMessage(c: Context) {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Payload JSON tidak valid' }, 400)
  }

  const websiteToken =
    (body.website_token as string) ||
    (body.websiteToken as string) ||
    c.req.header('X-Website-Token')
  if (!websiteToken || typeof websiteToken !== 'string' || !websiteToken.trim()) {
    return c.json({ error: 'Parameter website_token wajib diisi' }, 400)
  }

  const inboxResult = await inboxService.findInboxByWebsiteToken(websiteToken.trim())
  if (!inboxResult) {
    return c.json({ error: 'Inbox dengan website_token tersebut tidak ditemukan' }, 404)
  }

  const content = (body.content as string) || ''
  if (!content || typeof content !== 'string' || !content.trim()) {
    return c.json({ error: 'Konten pesan wajib diisi' }, 400)
  }

  const sessionId =
    (body.session_id as string) || (body.sessionId as string) || `visitor_${crypto.randomUUID()}`

  const contactData = (body.contact as Record<string, string> | undefined) || {}

  const result = await conversationService.handleInboundMessage({
    inboxId: inboxResult.inbox.id,
    sourceId: sessionId,
    senderName: contactData.name || 'Pengunjung Web',
    senderPhone: contactData.phone || null,
    content: content.trim(),
    messageType: 'incoming',
  })

  return c.json(
    {
      success: true,
      session_id: sessionId,
      conversation_id: result.conversation.id,
      message: result.message,
      contact: result.contact,
    },
    201,
  )
}

export async function handleWidgetStream(c: Context) {
  const websiteToken = c.req.query('website_token') || c.req.header('X-Website-Token')
  const sessionId = c.req.query('session_id') || c.req.query('sessionId')

  if (!websiteToken || !sessionId) {
    return c.json({ error: 'website_token dan session_id wajib diisi' }, 400)
  }

  const inboxResult = await inboxService.findInboxByWebsiteToken(websiteToken.trim())
  if (!inboxResult) {
    return c.json({ error: 'Inbox dengan website_token tersebut tidak ditemukan' }, 404)
  }

  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')

  return streamSSE(c, async (stream) => {
    const queue = new AsyncEventQueue<RealtimeEvent>()
    const unsubscribe = realtimeService.subscribe(queue)

    stream.onAbort(() => {
      unsubscribe()
      queue.close()
    })

    // Initial handshake event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        status: 'connected',
        session_id: sessionId,
        inbox_id: inboxResult.inbox.id,
        timestamp: new Date().toISOString(),
      }),
    })

    while (!stream.aborted) {
      const event = await queue.next()
      if (!event || stream.aborted) {
        break
      }

      await stream.writeSSE({
        event: event.event,
        data: JSON.stringify(event.data),
        id: event.id || String(Date.now()),
      })
    }

    unsubscribe()
    queue.close()
  })
}

export async function handleWidgetConfig(c: Context) {
  const websiteToken = c.req.query('website_token') || c.req.header('X-Website-Token')
  if (!websiteToken) {
    return c.json({ error: 'website_token wajib diisi' }, 400)
  }

  const inboxResult = await inboxService.findInboxByWebsiteToken(websiteToken.trim())
  if (!inboxResult) {
    return c.json({ error: 'Inbox dengan website_token tersebut tidak ditemukan' }, 404)
  }

  return c.json({
    inboxId: inboxResult.inbox.id,
    name: inboxResult.inbox.name,
    widgetColor: inboxResult.channel.widgetColor,
    replyTime: inboxResult.channel.replyTime,
    greetingEnabled: inboxResult.inbox.greetingEnabled,
    greetingMessage: inboxResult.inbox.greetingMessage,
  })
}
