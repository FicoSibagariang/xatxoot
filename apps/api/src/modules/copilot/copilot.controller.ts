import {
  AiChangeToneRequestSchema,
  AiCopilotActionRequestSchema,
  AiDraftReplyRequestSchema,
  CreateAiSettingInputSchema,
} from '@xatxoot/shared'
import type { Context } from 'hono'
import { copilotService } from './copilot.service'

export class CopilotController {
  async executeAction(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = AiCopilotActionRequestSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ success: false, errors: parsed.error.issues }, 400)
      }

      const result = await copilotService.executeAction(parsed.data)
      return c.json({ success: true, data: result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memproses aksi AI Copilot'
      return c.json({ success: false, message }, 500)
    }
  }

  async summarize(c: Context) {
    try {
      const body = await c.req.json()
      const conversationId = body?.conversationId
      if (!conversationId) {
        return c.json({ success: false, message: 'conversationId wajib diisi' }, 400)
      }

      const result = await copilotService.summarizeConversation({
        conversationId,
        messages: body?.messages,
        maxLength: body?.maxLength,
        injectToStickyNote: Boolean(body?.injectToStickyNote),
        updatedBy: body?.updatedBy,
      })

      return c.json({ success: true, data: result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal merangkum percakapan'
      return c.json({ success: false, message }, 500)
    }
  }

  async changeTone(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = AiChangeToneRequestSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ success: false, errors: parsed.error.issues }, 400)
      }

      const result = await copilotService.changeTone(parsed.data)
      return c.json({ success: true, data: result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengubah nada tulisan'
      return c.json({ success: false, message }, 500)
    }
  }

  async draftReply(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = AiDraftReplyRequestSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ success: false, errors: parsed.error.issues }, 400)
      }

      const result = await copilotService.draftReplyWithRag(parsed.data)
      return c.json({ success: true, data: result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyusun draf balasan RAG'
      return c.json({ success: false, message }, 500)
    }
  }

  async getSettings(c: Context) {
    try {
      const setting = await copilotService.getAiSetting()
      return c.json({ success: true, data: setting })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengambil pengaturan AI'
      return c.json({ success: false, message }, 500)
    }
  }

  async updateSettings(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = CreateAiSettingInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ success: false, errors: parsed.error.issues }, 400)
      }

      const setting = await copilotService.updateAiSetting(parsed.data)
      return c.json({ success: true, data: setting })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui pengaturan AI'
      return c.json({ success: false, message }, 500)
    }
  }

  async testConnection(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}))
      const result = await copilotService.testConnection({
        provider: body?.provider,
        apiKey: body?.apiKey,
        modelName: body?.modelName,
        baseUrl: body?.baseUrl,
        prompt: body?.prompt,
      })

      if (!result.verified) {
        return c.json({ success: false, message: result.message, data: result }, 400)
      }

      return c.json({ success: true, data: result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menguji koneksi AI'
      return c.json({ success: false, message }, 500)
    }
  }
}

export const copilotController = new CopilotController()
