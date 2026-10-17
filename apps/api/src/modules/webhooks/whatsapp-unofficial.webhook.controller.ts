import type { Context } from 'hono'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'

export interface WhatsAppUnofficialInboundBody {
  channelId?: string
  inboxId?: string
  senderNumber: string
  senderName?: string
  externalMessageId?: string
  messageType?: string
  content?: string
  mediaUrl?: string
  timestamp?: string
}

export async function handleWhatsAppUnofficialInbound(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as WhatsAppUnofficialInboundBody & {
      sessionId?: string
    }
    console.log(
      '[api-webhook] [DEBUG] Webhook received inbound message payload:',
      JSON.stringify(body),
    )

    if (!body || !body.senderNumber) {
      console.warn('[api-webhook] [DEBUG] Rejected: senderNumber is required')
      return c.json({ error: 'senderNumber is required' }, 400)
    }

    let inboxId = body.inboxId

    // 1. If inboxId is missing or default, resolve by sessionId if available
    if ((!inboxId || inboxId === 'default' || inboxId === 'active') && body.sessionId) {
      const inboxBySession = await inboxService.getInboxBySessionId(body.sessionId)
      if (inboxBySession) {
        inboxId = inboxBySession.inbox.id
      }
    }

    // 2. Fallback to default unofficial inbox if still unresolved
    if (!inboxId || inboxId === 'default' || inboxId === 'active') {
      const defaultInbox = await inboxService.getInboxById('default')
      if (defaultInbox) {
        inboxId = defaultInbox.inbox.id
      }
    }

    if (!inboxId) {
      console.warn('[api-webhook] [DEBUG] Rejected: Valid inboxId could not be resolved')
      return c.json({ error: 'Valid inboxId could not be resolved' }, 400)
    }

    const cleanSenderNumber = body.senderNumber.replace(/[^0-9]/g, '')
    const formattedPhone = cleanSenderNumber.startsWith('+')
      ? cleanSenderNumber
      : `+${cleanSenderNumber}`

    console.log(
      `[api-webhook] [DEBUG] Processing message for sender=${formattedPhone}, inboxId=${inboxId}`,
    )

    const result = await conversationService.handleInboundMessage({
      inboxId,
      sourceId: cleanSenderNumber,
      senderPhone: formattedPhone,
      senderName: body.senderName || formattedPhone,
      content: body.content || '',
      externalId: body.externalMessageId || `wa_${Date.now()}`,
      messageType: body.messageType || 'text',
      mediaUrl: body.mediaUrl,
    })

    console.log(
      `[api-webhook] [DEBUG] Inbound message processed successfully! conversationId=${result.conversation.id}, ticketId=${result.ticket.id}, messageId=${result.message.id}`,
    )

    return c.json({
      success: true,
      conversationId: result.conversation.id,
      ticketId: result.ticket.id,
      messageId: result.message.id,
      contactId: result.contact.id,
    })
  } catch (err) {
    console.error('[api-webhook] [DEBUG] Inbound error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}
