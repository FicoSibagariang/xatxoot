export interface AttachmentInputDto {
  fileType: string
  fileUrl: string
  fileName?: string | null
  fileSize?: number
  metadata?: Record<string, unknown>
}

export interface SendMessageInput {
  conversationId: string
  content?: string | null
  contentType?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'file' | string
  attachments?: AttachmentInputDto[]
  senderType?: 'user' | 'contact' | 'bot' | 'system'
  senderId?: string | null
  senderName?: string | null
  replyToMessageId?: string | null
  simulateError?: string | null
  isForwarded?: boolean
  forwardingScore?: number
  originalMessageId?: string
}

export interface ForwardMessageInput {
  sourceMessageId: string
  targetConversationId?: string
  targetJid?: string
  targetPhone?: string
  senderId?: string
  senderName?: string
}
