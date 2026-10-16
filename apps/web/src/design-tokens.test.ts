import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import tailwindConfig from '../tailwind.config.js'

describe('Tailwind Design Tokens & Arbitrary Hex Elimination (Issue #269)', () => {
  describe('1. Tailwind Design Token Expansion', () => {
    it('should define NavRail dark surface tokens in wa theme palette', () => {
      const wa = tailwindConfig.theme?.extend?.colors?.wa
      expect(wa).toBeDefined()
      expect(wa['rail-bg']).toBe('#111b21')
      expect(wa['surface-dark']).toBe('#202c33')
      expect(wa['hover-dark']).toBe('#2a3942')
    })

    it('should define WhatsApp teal brand color variations', () => {
      const wa = tailwindConfig.theme?.extend?.colors?.wa
      expect(wa['teal-primary']).toBe('#00a884')
      expect(wa['teal-dark']).toBe('#008069')
      expect(wa['teal-hover']).toBe('#008f6f')
      expect(wa['teal-active']).toBe('#007a5e')
    })

    it('should define WhatsApp text color tokens', () => {
      const wa = tailwindConfig.theme?.extend?.colors?.wa
      expect(wa['text-primary']).toBe('#111b21')
      expect(wa['text-secondary']).toBe('#667781')
      expect(wa['text-muted']).toBe('#54656f')
      expect(wa['text-subtle']).toBe('#8696a0')
      expect(wa['text-meta']).toBe('#41525d')
    })

    it('should define WhatsApp layout and bubble tokens', () => {
      const wa = tailwindConfig.theme?.extend?.colors?.wa
      expect(wa['header-bg']).toBe('#f0f2f5')
      expect(wa['chat-bg']).toBe('#efeae2')
      expect(wa.border).toBe('#e9edef')
      expect(wa['bubble-in']).toBe('#ffffff')
      expect(wa['bubble-out']).toBe('#d9fdd3')
      expect(wa['bubble-light']).toBe('#e7fce3')
      expect(wa['bubble-active']).toBe('#c1f7b7')
      expect(wa['search-bg']).toBe('#f5f6f6')
      expect(wa['hover-light']).toBe('#f9fafb')
      expect(wa['card-highlight']).toBe('#fcfdfd')
      expect(wa['note-card-bg']).toBe('#fef3c7')
      expect(wa['note-border']).toBe('#fde68a')
      expect(wa['tick-blue']).toBe('#53bdeb')
      expect(wa['badge-unread']).toBe('#25d366')
    })
  })

  describe('2. Elimination of Arbitrary Hex Colors in Production Components', () => {
    function getAllComponentFiles(dir: string): string[] {
      const files: string[] = []
      const entries = readdirSync(dir)

      for (const entry of entries) {
        const fullPath = join(dir, entry)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          files.push(...getAllComponentFiles(fullPath))
        } else if (
          (entry.endsWith('.tsx') || entry.endsWith('.ts')) &&
          !entry.endsWith('.test.tsx') &&
          !entry.endsWith('.test.ts')
        ) {
          files.push(fullPath)
        }
      }
      return files
    }

    it('should have 0 arbitrary hex color usages in production components', () => {
      const srcDir = join(import.meta.dir, '..', 'src')
      const files = getAllComponentFiles(srcDir)
      const arbitraryHexRegex = /\[#[0-9a-fA-F]{3,8}\]/g
      const violations: { file: string; matches: string[] }[] = []

      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const matches = content.match(arbitraryHexRegex)
        if (matches && matches.length > 0) {
          violations.push({
            file: file.replace(srcDir, ''),
            matches,
          })
        }
      }

      if (violations.length > 0) {
        const summary = violations
          .map(
            (v) => `${v.file}: ${v.matches.length} matches (${v.matches.slice(0, 3).join(', ')})`,
          )
          .join('\n')
        expect(violations.length).toBe(0)
      }

      expect(violations).toHaveLength(0)
    })
  })

  describe('3. Single Organization Guardrail', () => {
    it('should strictly NOT contain multi-tenant account_id in web codebase', () => {
      const srcDir = join(import.meta.dir, '..', 'src')
      const files = readdirSync(srcDir, { recursive: true }) as string[]
      for (const relPath of files) {
        const fullPath = join(srcDir, relPath)
        if (
          statSync(fullPath).isFile() &&
          (relPath.endsWith('.ts') || relPath.endsWith('.tsx')) &&
          !relPath.endsWith('.test.ts') &&
          !relPath.endsWith('.test.tsx')
        ) {
          const content = readFileSync(fullPath, 'utf-8')
          expect(content).not.toContain('account_id')
        }
      }
    })
  })
})
