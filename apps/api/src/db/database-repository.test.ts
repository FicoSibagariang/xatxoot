import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function findServiceFiles(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)

  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...findServiceFiles(fullPath))
    } else if (item.endsWith('.service.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

describe('Database Repository Layer & Elimination of Dual-State Memory Fallback (Issue #308 - TDD RED)', () => {
  const modulesDir = join(import.meta.dir, '..', 'modules')
  const serviceFiles = findServiceFiles(modulesDir)

  it('should have found production service files in apps/api/src/modules/', () => {
    expect(serviceFiles.length).toBeGreaterThan(15)
  })

  it('should NOT contain any memoryStore declaration in production service files (*.service.ts)', () => {
    const filesWithMemoryStore: string[] = []

    for (const filePath of serviceFiles) {
      const content = readFileSync(filePath, 'utf-8')
      if (content.includes('const memoryStore') || content.includes('let memoryStore')) {
        filesWithMemoryStore.push(filePath.replace(modulesDir, 'apps/api/src/modules'))
      }
    }

    expect(filesWithMemoryStore).toEqual([])
  })

  it('should NOT contain silent catch-all empty fallback blocks in production service files (*.service.ts)', () => {
    const filesWithSilentFallbacks: string[] = []

    for (const filePath of serviceFiles) {
      const content = readFileSync(filePath, 'utf-8')
      // Pattern matching empty catch blocks with comments like "Memory fallback", "DB offline fallback", etc.
      if (
        /catch\s*\{\s*\/\/\s*(Memory fallback|DB offline fallback|fallback)/i.test(content) ||
        /catch\s*\([a-zA-Z0-9_]+\)\s*\{\s*\/\/\s*(Memory fallback|DB offline fallback|fallback)/i.test(
          content,
        )
      ) {
        filesWithSilentFallbacks.push(filePath.replace(modulesDir, 'apps/api/src/modules'))
      }
    }

    expect(filesWithSilentFallbacks).toEqual([])
  })
})
