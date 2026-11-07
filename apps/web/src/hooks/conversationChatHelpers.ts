import type { ContentType, MessageType, TimelineMessage } from '../components/chat'

export function formatDateGroup(dateStr?: string | Date): string {
  if (!dateStr) return 'HARI INI'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'HARI INI'
  const today = new Date()
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  if (isToday) return 'HARI INI'

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  if (isYesterday) return 'KEMARIN'

  return d
    .toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase()
}

export function parseContentAttributes(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return {}
}

export function areMessagesIdentical(
  current?: TimelineMessage[],
  incoming?: TimelineMessage[],
): boolean {
  if (!current || !incoming) return false
  if (current.length !== incoming.length) return false
  return current.every(
    (msg, i) =>
      msg.id === incoming[i]?.id &&
      msg.status === incoming[i]?.status &&
      msg.content === incoming[i]?.content &&
      Boolean(msg.replyTo) === Boolean(incoming[i]?.replyTo),
  )
}

export function mapRawConversationMessage(
  // biome-ignore lint/suspicious/noExplicitAny: generic raw message
  m: any,
  // biome-ignore lint/suspicious/noExplicitAny: generic raw conversation detail
  data: any,
  user: { id?: string; name?: string },
): TimelineMessage {
  const isCustomer = m.senderType === 'contact' || m.senderType === 'customer'
  const msgType: MessageType =
    m.messageType === 'activity' || m.senderType === 'system'
      ? 'activity'
      : isCustomer
        ? 'incoming'
        : 'outgoing'

  const attrs = parseContentAttributes(m.contentAttributes)
  const isEcho = Boolean(m.isEcho || attrs.echo || attrs.source === 'whatsapp_mobile')
  const isMsgGroup = Boolean(m.isGroup || attrs.isGroup || data?.conversation?.isGroup)
  const participant = m.participant || attrs.participant
  const participantName = m.participantName || attrs.participantName
  const senderName = isCustomer
    ? isMsgGroup && participantName
      ? participantName
      : data?.contact?.name || data?.contact?.phoneNumber || 'Pelanggan'
    : m.senderName ||
      attrs.senderName ||
      (isEcho ? 'WhatsApp HP' : m.senderType === 'bot' ? 'Bot Otomasi' : user.name)

  return {
    id: m.id,
    conversationId: m.conversationId,
    ticketId: m.ticketId,
    ticketDisplayId: m.ticketDisplayId,
    senderId: m.senderId || (isCustomer ? 'customer' : user.id),
    senderType: isCustomer ? 'contact' : m.senderType || 'user',
    senderName,
    isGroup: isMsgGroup,
    participant: participant ? String(participant) : undefined,
    participantName: participantName ? String(participantName) : undefined,
    isEcho,
    contentAttributes: m.contentAttributes,
    messageType: msgType,
    contentType:
      (m.contentType && m.contentType !== 'text' ? m.contentType : undefined) ||
      (m.messageType === 'image' ? 'image' : undefined) ||
      (attrs.contentType as ContentType) ||
      (m.contentType as ContentType) ||
      'text',
    mediaUrl:
      m.mediaUrl ||
      attrs.mediaUrl ||
      (Array.isArray(m.attachments) && m.attachments[0]?.fileUrl) ||
      undefined,
    content: m.content || '',
    timestamp: m.createdAt
      ? new Date(m.createdAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Baru saja',
    dateGroup: formatDateGroup(m.createdAt),
    status: m.status || (isCustomer ? 'delivered' : 'read'),
    isEdited: Boolean(m.contentAttributes?.isEdited || m.isEdited),
    editedAt: m.contentAttributes?.editedAt || m.editedAt,
    editHistory: m.contentAttributes?.editHistory || m.editHistory || [],
    isDeletedBySender: Boolean(
      m.contentAttributes?.isDeletedBySender || m.status === 'deleted_by_sender',
    ),
    deletedAt: m.contentAttributes?.deletedAt,
    revokedOriginalContent: m.contentAttributes?.revokedOriginalContent,
    replyTo: m.replyTo || m.contentAttributes?.replyTo || null,
  }
}
