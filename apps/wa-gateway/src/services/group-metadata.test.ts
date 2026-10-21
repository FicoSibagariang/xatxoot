import { describe, expect, it, mock } from 'bun:test'
import { BaileysSession } from './baileys-session'

describe('WhatsApp Gateway - Group Metadata Retrieval & Caching (TDD RED)', () => {
  it('should fetch group metadata subject from socket and cache it', async () => {
    const session = new BaileysSession({
      sessionId: 'session_group_meta_test_01',
      channelId: '11111111-1111-4111-8111-111111111111',
      inboxId: '22222222-2222-4222-8222-222222222222',
    })

    const mockGroupMetadata = mock(async (jid: string) => {
      return {
        id: jid,
        subject: 'NOC Alert & Monitoring',
        owner: '62811111111@s.whatsapp.net',
      }
    })

    session.socket = {
      groupMetadata: mockGroupMetadata,
    }

    const groupJid = '120363209784423627@g.us'
    // First call: should query socket
    const name1 = await session.getGroupSubject(groupJid)
    expect(name1).toBe('NOC Alert & Monitoring')
    expect(mockGroupMetadata).toHaveBeenCalledTimes(1)

    // Second call: should use cache, NOT calling socket again
    const name2 = await session.getGroupSubject(groupJid)
    expect(name2).toBe('NOC Alert & Monitoring')
    expect(mockGroupMetadata).toHaveBeenCalledTimes(1)
  })

  it('should update cached subject when groups.update event is emitted', async () => {
    const session = new BaileysSession({
      sessionId: 'session_group_meta_test_02',
    })

    const groupJid = '120363209784423627@g.us'
    // Manually trigger or set subject
    session.updateGroupSubjectCache(groupJid, 'DevOps Incident Room')

    const subject = await session.getGroupSubject(groupJid)
    expect(subject).toBe('DevOps Incident Room')
  })
})
