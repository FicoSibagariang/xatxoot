import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { messageService } from './messages.service'

describe('Clean Mock and Hardcoded Values (Issue #310 - TDD RED)', () => {
  it('Production code in apps/api/src must strictly NOT contain hardcoded "Nia" string', () => {
    const srcDir = join(import.meta.dir, '..', '..')
    const filesToCheck = [
      join(srcDir, 'modules', 'conversations', 'conversation.types.ts'),
      join(srcDir, 'modules', 'conversations', 'conversation-echo.service.ts'),
      join(srcDir, 'modules', 'conversations', 'conversations.service.ts'),
    ]

    for (const file of filesToCheck) {
      const content = readFileSync(file, 'utf-8')
      expect(content).not.toContain("'Nia'")
      expect(content).not.toContain('"Nia"')
    }
  })

  it('Production code in apps/api/src must strictly NOT contain fallback UUID 3b87d597-cde4-4b3e-8cce-e3bd24ac1c4f', () => {
    const srcDir = join(import.meta.dir, '..', '..')
    const filesToCheck = [
      join(srcDir, 'modules', 'messages', 'messages.service.ts'),
      join(srcDir, 'modules', 'tickets', 'tickets.service.ts'),
    ]

    for (const file of filesToCheck) {
      const content = readFileSync(file, 'utf-8')
      expect(content).not.toContain('3b87d597-cde4-4b3e-8cce-e3bd24ac1c4f')
    }
  })

  it('sendMessage() should reject invalid non-UUID senderId for user senderType', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'SenderId Validation Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281200000099',
        phoneNumberId: '1000000099',
        wabaId: 'waba_00000099',
        accessToken: 'EAAB_token_99',
        webhookVerifyToken: 'verify_token_99',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+6289900001111',
      senderName: 'Pelanggan Uji',
      content: 'Halo',
    })

    await expect(
      messageService.sendMessage({
        conversationId: inbound.conversation.id,
        content: 'Balasan pesan',
        senderType: 'user',
        senderId: 'invalid-non-uuid-agent',
      }),
    ).rejects.toThrow(/invalid senderid/i)
  })
})
