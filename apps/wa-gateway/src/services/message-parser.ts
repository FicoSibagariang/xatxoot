import type { WaInboundMessageEvent, WaInboundMessageType } from '../types/events'

export interface WAMessageKey {
  remoteJid?: string | null
  fromMe?: boolean | null
  id?: string | null
}

export interface WAMessageContextInfo {
  stanzaId?: string | null
  participant?: string | null
  // biome-ignore lint/suspicious/noExplicitAny: quotedMessage structure varies
  quotedMessage?: any
  isForwarded?: boolean | null
  forwardingScore?: number | null
  mentionedJid?: string[] | null
}

export interface WAMessageContent {
  conversation?: string | null
  extendedTextMessage?: {
    text?: string | null
    contextInfo?: WAMessageContextInfo | null
  } | null
  imageMessage?: {
    caption?: string | null
    mimetype?: string | null
    fileLength?: number | null
    contextInfo?: WAMessageContextInfo | null
  } | null
  videoMessage?: {
    caption?: string | null
    mimetype?: string | null
    fileLength?: number | null
    contextInfo?: WAMessageContextInfo | null
  } | null
  audioMessage?: {
    mimetype?: string | null
    fileLength?: number | null
    contextInfo?: WAMessageContextInfo | null
  } | null
  documentMessage?: {
    caption?: string | null
    fileName?: string | null
    mimetype?: string | null
    fileLength?: number | null
    contextInfo?: WAMessageContextInfo | null
  } | null
  locationMessage?: {
    degreesLatitude?: number | null
    degreesLongitude?: number | null
    contextInfo?: WAMessageContextInfo | null
  } | null
  stickerMessage?: {
    mimetype?: string | null
    contextInfo?: WAMessageContextInfo | null
  } | null
  protocolMessage?: {
    key?: WAMessageKey | null
    type?: number | null
    // biome-ignore lint/suspicious/noExplicitAny: nested editedMessage
    editedMessage?: any
    timestampMs?: number | string | null
  } | null
}

export interface MinimalWAMessage {
  key?: WAMessageKey | null
  pushName?: string | null
  message?: WAMessageContent | null
  messageTimestamp?: number | null
}

export function extractQuotedText(
  // biome-ignore lint/suspicious/noExplicitAny: quoted message varies across protocols
  quotedMsg?: any,
): string | undefined {
  if (!quotedMsg || typeof quotedMsg !== 'object') return undefined
  if (typeof quotedMsg.conversation === 'string' && quotedMsg.conversation) {
    return quotedMsg.conversation
  }
  if (
    typeof quotedMsg.extendedTextMessage?.text === 'string' &&
    quotedMsg.extendedTextMessage.text
  ) {
    return quotedMsg.extendedTextMessage.text
  }
  if (typeof quotedMsg.imageMessage?.caption === 'string' && quotedMsg.imageMessage.caption) {
    return quotedMsg.imageMessage.caption
  }
  if (quotedMsg.imageMessage) {
    return '[Gambar]'
  }
  if (typeof quotedMsg.videoMessage?.caption === 'string' && quotedMsg.videoMessage.caption) {
    return quotedMsg.videoMessage.caption
  }
  if (quotedMsg.videoMessage) {
    return '[Video]'
  }
  if (typeof quotedMsg.documentMessage?.caption === 'string' && quotedMsg.documentMessage.caption) {
    return quotedMsg.documentMessage.caption
  }
  if (
    typeof quotedMsg.documentMessage?.fileName === 'string' &&
    quotedMsg.documentMessage.fileName
  ) {
    return quotedMsg.documentMessage.fileName
  }
  if (quotedMsg.documentMessage) {
    return '[Dokumen]'
  }
  if (quotedMsg.audioMessage) {
    return '[Audio]'
  }
  if (quotedMsg.stickerMessage) {
    return '[Stiker]'
  }
  if (quotedMsg.locationMessage) {
    return '[Lokasi]'
  }
  return undefined
}

export function extractInboundMessage(
  wam: unknown,
  context: {
    channelId: string
    inboxId: string
    allowSelfChat?: boolean
    isEcho?: boolean
    channelPhone?: string
    companyPhoneNumbers?: string[]
    participantMap?: Record<string, { phone?: string; name?: string }>
  },
): WaInboundMessageEvent | null {
  if (!wam || typeof wam !== 'object') {
    return null
  }

  const msg = wam as MinimalWAMessage
  const key = msg.key
  if (!key || !key.remoteJid || !key.id) {
    return null
  }

  const remoteJid = key.remoteJid
  const isGroup = remoteJid.endsWith('@g.us')
  // biome-ignore lint/suspicious/noExplicitAny: Baileys alt properties
  const anyKey = key as any
  // biome-ignore lint/suspicious/noExplicitAny: Baileys raw msg properties
  const anyMsg = msg as any

  let groupJid: string | undefined
  let participant: string | undefined

  if (isGroup) {
    groupJid = remoteJid
    const rawParticipant =
      key.participant || anyKey.participantAlt || anyMsg.participant || anyMsg.key?.participant
    if (rawParticipant && typeof rawParticipant === 'string') {
      participant = rawParticipant.split('@')[0].split(':')[0]
    }
  }

  // Check if participant is internal company number
  const isInternalParticipant = Boolean(
    participant &&
      (context.companyPhoneNumbers?.includes(participant) ||
        (context.channelPhone && context.channelPhone === participant)),
  )

  const isEcho = Boolean(context.isEcho || isInternalParticipant)

  // Ignore outgoing messages sent by the device (unless testing via self-chat or echo sync)
  if (key.fromMe && !context.allowSelfChat && !isEcho) {
    return null
  }

  // Ignore status broadcasts
  if (remoteJid === 'status@broadcast' || remoteJid.includes('@broadcast')) {
    return null
  }

  // If remoteJid is an LID, extract actual phone number from remoteJidAlt / participantAlt
  let senderJid = remoteJid
  if (senderJid.endsWith('@lid')) {
    if (
      anyKey.remoteJidAlt &&
      typeof anyKey.remoteJidAlt === 'string' &&
      anyKey.remoteJidAlt.includes('@s.whatsapp.net')
    ) {
      senderJid = anyKey.remoteJidAlt
    } else if (
      anyKey.participantAlt &&
      typeof anyKey.participantAlt === 'string' &&
      anyKey.participantAlt.includes('@s.whatsapp.net')
    ) {
      senderJid = anyKey.participantAlt
    }
  }

  const senderNumber = senderJid.split('@')[0].split(':')[0]
  // biome-ignore lint/suspicious/noExplicitAny: Baileys nested message wrapper
  let contentObj: any = msg.message
  if (!contentObj) {
    return null
  }

  // Unwrap ephemeral, viewOnce, or other wrappers
  while (
    contentObj?.ephemeralMessage?.message ||
    contentObj?.viewOnceMessage?.message ||
    contentObj?.viewOnceMessageV2?.message ||
    contentObj?.documentWithCaptionMessage?.message
  ) {
    contentObj =
      contentObj.ephemeralMessage?.message ||
      contentObj.viewOnceMessage?.message ||
      contentObj.viewOnceMessageV2?.message ||
      contentObj.documentWithCaptionMessage?.message
  }

  // Handle Baileys revoked message (protocolMessage type 0 / REVOKE)
  if (contentObj?.protocolMessage && contentObj.protocolMessage.type === 0) {
    const protoMsg = contentObj.protocolMessage
    const targetExternalId = protoMsg.key?.id
    if (!targetExternalId) {
      return null
    }

    const timestamp = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString()

    return {
      channelId: context.channelId,
      inboxId: context.inboxId,
      senderNumber,
      senderName: context.isEcho || key.fromMe ? undefined : msg.pushName || undefined,
      externalMessageId: key.id,
      targetExternalId,
      isRevoke: true,
      revokedAt: timestamp,
      messageType: 'text',
      content: undefined,
      timestamp,
      isEcho: context.isEcho ? true : undefined,
    }
  }

  // Handle Baileys edited message (protocolMessage type 14 / MESSAGE_EDIT)
  if (
    contentObj?.protocolMessage &&
    (contentObj.protocolMessage.type === 14 || Boolean(contentObj.protocolMessage.editedMessage))
  ) {
    const protoMsg = contentObj.protocolMessage
    const targetExternalId = protoMsg.key?.id
    if (!targetExternalId) {
      return null
    }

    let editedContentObj = protoMsg.editedMessage
    while (
      editedContentObj?.ephemeralMessage?.message ||
      editedContentObj?.viewOnceMessage?.message ||
      editedContentObj?.viewOnceMessageV2?.message ||
      editedContentObj?.documentWithCaptionMessage?.message
    ) {
      editedContentObj =
        editedContentObj.ephemeralMessage?.message ||
        editedContentObj.viewOnceMessage?.message ||
        editedContentObj.viewOnceMessageV2?.message ||
        editedContentObj.documentWithCaptionMessage?.message
    }

    let newContent = ''
    if (typeof editedContentObj?.conversation === 'string') {
      newContent = editedContentObj.conversation
    } else if (editedContentObj?.extendedTextMessage?.text) {
      newContent = editedContentObj.extendedTextMessage.text
    } else if (editedContentObj?.imageMessage?.caption) {
      newContent = editedContentObj.imageMessage.caption
    } else if (editedContentObj?.videoMessage?.caption) {
      newContent = editedContentObj.videoMessage.caption
    } else if (editedContentObj?.documentMessage?.caption) {
      newContent = editedContentObj.documentMessage.caption
    }

    const timestamp = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString()

    return {
      channelId: context.channelId,
      inboxId: context.inboxId,
      senderNumber,
      senderName: context.isEcho || key.fromMe ? undefined : msg.pushName || undefined,
      externalMessageId: key.id,
      targetExternalId,
      isEdit: true,
      newContent,
      editedAt: timestamp,
      messageType: 'text',
      content: newContent,
      timestamp,
      isEcho: context.isEcho ? true : undefined,
    }
  }

  let messageType: WaInboundMessageType = 'text'
  let content: string | undefined
  let media: WaInboundMessageEvent['media'] | undefined

  if (typeof contentObj.conversation === 'string') {
    messageType = 'text'
    content = contentObj.conversation
  } else if (contentObj.extendedTextMessage) {
    messageType = 'text'
    content = contentObj.extendedTextMessage.text || undefined
  } else if (contentObj.imageMessage) {
    messageType = 'image'
    content = contentObj.imageMessage.caption || undefined
    media = {
      mimeType: contentObj.imageMessage.mimetype || 'image/jpeg',
      fileSize: contentObj.imageMessage.fileLength
        ? Number(contentObj.imageMessage.fileLength)
        : undefined,
    }
  } else if (contentObj.videoMessage) {
    messageType = 'video'
    content = contentObj.videoMessage.caption || undefined
    media = {
      mimeType: contentObj.videoMessage.mimetype || 'video/mp4',
      fileSize: contentObj.videoMessage.fileLength
        ? Number(contentObj.videoMessage.fileLength)
        : undefined,
    }
  } else if (contentObj.audioMessage) {
    messageType = 'audio'
    media = {
      mimeType: contentObj.audioMessage.mimetype || 'audio/ogg',
      fileSize: contentObj.audioMessage.fileLength
        ? Number(contentObj.audioMessage.fileLength)
        : undefined,
    }
  } else if (contentObj.documentMessage) {
    messageType = 'document'
    content = contentObj.documentMessage.caption || undefined
    media = {
      mimeType: contentObj.documentMessage.mimetype || 'application/octet-stream',
      fileName: contentObj.documentMessage.fileName || undefined,
      fileSize: contentObj.documentMessage.fileLength
        ? Number(contentObj.documentMessage.fileLength)
        : undefined,
    }
  } else if (contentObj.locationMessage) {
    messageType = 'location'
    const lat = contentObj.locationMessage.degreesLatitude ?? 0
    const lng = contentObj.locationMessage.degreesLongitude ?? 0
    content = `${lat},${lng}`
  } else if (contentObj.stickerMessage) {
    messageType = 'sticker'
    media = {
      mimeType: contentObj.stickerMessage.mimetype || 'image/webp',
    }
  } else if (contentObj.buttonsResponseMessage) {
    messageType = 'text'
    content =
      contentObj.buttonsResponseMessage.selectedDisplayText ||
      contentObj.buttonsResponseMessage.selectedButtonId ||
      undefined
  } else if (contentObj.listResponseMessage) {
    messageType = 'text'
    content =
      contentObj.listResponseMessage.title ||
      contentObj.listResponseMessage.singleSelectReply?.selectedRowId ||
      undefined
  } else if (contentObj.templateButtonReplyMessage) {
    messageType = 'text'
    content =
      contentObj.templateButtonReplyMessage.selectedDisplayText ||
      contentObj.templateButtonReplyMessage.selectedId ||
      undefined
  } else {
    return null
  }

  // Extract ContextInfo (Quoted reply info) across all message types
  const rawContextInfo: WAMessageContextInfo | undefined =
    contentObj.extendedTextMessage?.contextInfo ||
    contentObj.imageMessage?.contextInfo ||
    contentObj.videoMessage?.contextInfo ||
    contentObj.documentMessage?.contextInfo ||
    contentObj.audioMessage?.contextInfo ||
    contentObj.stickerMessage?.contextInfo ||
    contentObj.locationMessage?.contextInfo ||
    // biome-ignore lint/suspicious/noExplicitAny: generic fallback
    (contentObj as any).buttonsResponseMessage?.contextInfo ||
    // biome-ignore lint/suspicious/noExplicitAny: generic fallback
    (contentObj as any).templateButtonReplyMessage?.contextInfo ||
    // biome-ignore lint/suspicious/noExplicitAny: generic fallback
    (contentObj as any).listResponseMessage?.contextInfo

  const replyToExternalId = rawContextInfo?.stanzaId || undefined
  const quotedParticipant = rawContextInfo?.participant || undefined
  const quotedText = extractQuotedText(rawContextInfo?.quotedMessage)
  const isForwarded = rawContextInfo?.isForwarded ? true : undefined
  const forwardingScore = isForwarded ? rawContextInfo?.forwardingScore || 1 : undefined

  let mentions: Array<{ jid: string; phone?: string; name?: string }> | undefined
  if (
    rawContextInfo?.mentionedJid &&
    Array.isArray(rawContextInfo.mentionedJid) &&
    rawContextInfo.mentionedJid.length > 0
  ) {
    mentions = rawContextInfo.mentionedJid.map((jid) => {
      const mapped = context.participantMap?.[jid]
      let phone = mapped?.phone
      const name = mapped?.name

      if (!phone) {
        if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us')) {
          phone = jid.split('@')[0].split(':')[0]
        }
      }

      return {
        jid,
        phone: phone || undefined,
        name: name || undefined,
      }
    })
  }

  const timestamp = msg.messageTimestamp
    ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
    : new Date().toISOString()

  return {
    channelId: context.channelId,
    inboxId: context.inboxId,
    senderNumber,
    senderName: isEcho || key.fromMe ? undefined : msg.pushName || undefined,
    externalMessageId: key.id,
    messageType,
    content,
    media,
    replyToExternalId,
    quotedText,
    quotedParticipant,
    timestamp,
    isEcho: isEcho ? true : undefined,
    isGroup: isGroup ? true : undefined,
    groupJid,
    participant,
    participantName: msg.pushName || undefined,
    isForwarded,
    forwardingScore,
    mentions,
  }
}
