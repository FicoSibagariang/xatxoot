import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Component Decomposition & Monolith Refactoring (Issue #270)', () => {
  const layoutDir = join(import.meta.dir)
  const webSrcDir = join(import.meta.dir, '..', '..')

  describe('1. File Structure & Sub-component Extraction', () => {
    it('should have separate NavRail.tsx component file', () => {
      const navRailPath = join(layoutDir, 'NavRail.tsx')
      expect(existsSync(navRailPath)).toBe(true)
    })

    it('should have separate ChatListPanel.tsx component file', () => {
      const chatListPanelPath = join(layoutDir, 'ChatListPanel.tsx')
      expect(existsSync(chatListPanelPath)).toBe(true)
    })

    it('should have separate ConversationThread.tsx component file', () => {
      const convThreadPath = join(layoutDir, 'ConversationThread.tsx')
      expect(existsSync(convThreadPath)).toBe(true)
    })

    it('should have separate mockData.ts in src/data', () => {
      const mockDataPath = join(webSrcDir, 'data', 'mockData.ts')
      expect(existsSync(mockDataPath)).toBe(true)
    })

    it('should have separate AppModals.tsx container for modal management', () => {
      const appModalsPath = join(webSrcDir, 'components', 'modals', 'AppModals.tsx')
      expect(existsSync(appModalsPath)).toBe(true)
    })
  })

  describe('2. File Line Count Constraints (Definition of Done: <= 500 lines)', () => {
    it('WhatsAppLayout.tsx should be a lean orchestrator with <= 500 lines', () => {
      const filePath = join(layoutDir, 'WhatsAppLayout.tsx')
      const content = readFileSync(filePath, 'utf-8')
      const lineCount = content.split('\n').length
      expect(lineCount).toBeLessThanOrEqual(500)
    })

    it('App.tsx should be streamlined with <= 500 lines', () => {
      const filePath = join(webSrcDir, 'App.tsx')
      const content = readFileSync(filePath, 'utf-8')
      const lineCount = content.split('\n').length
      expect(lineCount).toBeLessThanOrEqual(500)
    })

    it('NavRail.tsx should be <= 500 lines', () => {
      const filePath = join(layoutDir, 'NavRail.tsx')
      expect(existsSync(filePath)).toBe(true)
      const content = readFileSync(filePath, 'utf-8')
      const lineCount = content.split('\n').length
      expect(lineCount).toBeLessThanOrEqual(500)
    })

    it('ChatListPanel.tsx should be <= 500 lines', () => {
      const filePath = join(layoutDir, 'ChatListPanel.tsx')
      expect(existsSync(filePath)).toBe(true)
      const content = readFileSync(filePath, 'utf-8')
      const lineCount = content.split('\n').length
      expect(lineCount).toBeLessThanOrEqual(500)
    })

    it('ConversationThread.tsx should be <= 500 lines', () => {
      const filePath = join(layoutDir, 'ConversationThread.tsx')
      expect(existsSync(filePath)).toBe(true)
      const content = readFileSync(filePath, 'utf-8')
      const lineCount = content.split('\n').length
      expect(lineCount).toBeLessThanOrEqual(500)
    })
  })

  describe('3. Single Organization Rule Guardrail', () => {
    it('should not contain multi-tenant account_id in decomposed files', () => {
      const targetFiles = [
        join(layoutDir, 'WhatsAppLayout.tsx'),
        join(layoutDir, 'NavRail.tsx'),
        join(layoutDir, 'ChatListPanel.tsx'),
        join(layoutDir, 'ConversationThread.tsx'),
        join(webSrcDir, 'App.tsx'),
        join(webSrcDir, 'data', 'mockData.ts'),
      ]

      for (const file of targetFiles) {
        if (existsSync(file)) {
          const content = readFileSync(file, 'utf-8')
          expect(content).not.toContain('account_id')
          expect(content).not.toContain('accountId')
        }
      }
    })
  })
})
