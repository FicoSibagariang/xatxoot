import type { Contact } from './conversation.types'

export interface GroupResolutionResult {
  isGroup: boolean
  groupJid?: string
  effectivePhone: string
  effectiveSourceId: string
  defaultName?: string
}

export class ConversationGroupService {
  private companyPhoneNumbers = new Set<string>()

  setCompanyPhoneNumbers(numbers: string[]): void {
    this.companyPhoneNumbers = new Set(numbers.map((n) => n.replace(/\D/g, '')))
  }

  isCompanyPhoneNumber(phone?: string | null): boolean {
    if (!phone) return false
    const clean = phone.replace(/\D/g, '')
    return this.companyPhoneNumbers.has(clean)
  }

  resolveGroupMetadata(payload: {
    isGroup?: boolean
    sourceId?: string
    groupJid?: string | null
    senderPhone?: string | null
    senderNumber?: string | null
    senderName?: string | null
    fallbackInboxId: string
  }): GroupResolutionResult {
    const isGroup = Boolean(
      payload.isGroup || payload.sourceId?.endsWith('@g.us') || payload.groupJid,
    )
    const groupJid =
      payload.groupJid || (payload.sourceId?.endsWith('@g.us') ? payload.sourceId : undefined)

    const effectivePhone =
      (isGroup && groupJid ? groupJid : payload.senderPhone) ||
      payload.senderNumber ||
      payload.sourceId ||
      `unknown_${Date.now()}`

    const effectiveSourceId =
      (isGroup && groupJid ? groupJid : payload.sourceId) ||
      effectivePhone ||
      payload.fallbackInboxId

    const defaultName = payload.senderName || (isGroup ? 'Grup WhatsApp' : undefined)

    return {
      isGroup,
      groupJid,
      effectivePhone,
      effectiveSourceId,
      defaultName,
    }
  }

  resolveParticipantSenderName(
    payload: {
      isGroup?: boolean
      participant?: string | null
      participantName?: string | null
      senderName?: string | null
      isInternal?: boolean
    },
    fallbackCustomerName: string,
  ): string {
    if (payload.isInternal) {
      return payload.participantName || payload.senderName || 'Internal'
    }
    return payload.participantName || fallbackCustomerName
  }

  detectGroupConversation(
    convRecord: Record<string, unknown>,
    contact: Contact | null,
  ): { isGroup: boolean; groupJid?: string } {
    const contactRecord = contact as Record<string, unknown> | null
    const isGroup = Boolean(
      convRecord.isGroup ||
        contact?.phoneNumber?.includes('@g.us') ||
        contact?.phoneNumber?.includes('120363') ||
        contact?.identifier?.includes('@g.us') ||
        contact?.identifier?.includes('120363') ||
        contactRecord?.contactType === 'group' ||
        (convRecord.customAttributes as Record<string, unknown>)?.isGroup,
    )

    const groupJid =
      (convRecord.groupJid as string | undefined) ||
      (convRecord.customAttributes as Record<string, unknown>)?.groupJid ||
      (contact?.phoneNumber?.includes('@g.us') ? contact.phoneNumber : undefined) ||
      (contact?.identifier?.includes('@g.us') ? contact.identifier : undefined) ||
      (isGroup && contact?.phoneNumber
        ? contact.phoneNumber.includes('@g.us')
          ? contact.phoneNumber
          : `${contact.phoneNumber.replace(/[^0-9]/g, '')}@g.us`
        : undefined)

    return { isGroup, groupJid: isGroup ? groupJid : undefined }
  }
}

export const conversationGroupService = new ConversationGroupService()
