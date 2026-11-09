import { describe, expect, it, mock } from 'bun:test'
import type React from 'react'
import { useState } from 'react'
import { renderToString } from 'react-dom/server'
import { ErrorBoundary } from './ErrorBoundary'
import { PageSkeleton } from './PageSkeleton'

// Helper component yang melempar error saat render
function BuggyComponent({ shouldThrow }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Simulated Component Crash!')
  }
  return <div data-testid="child-content">Normal Content Loaded</div>
}

describe('React Error Boundary & Route-Based Code Splitting (Issue #322 - TDD RED)', () => {
  describe('1. ErrorBoundary Component', () => {
    it('should render children normally when no error occurs', () => {
      const html = renderToString(
        <ErrorBoundary>
          <BuggyComponent shouldThrow={false} />
        </ErrorBoundary>,
      )
      expect(html).toContain('Normal Content Loaded')
      expect(html).not.toContain('Muat Ulang Komponen')
    })

    it('should catch component error and render fallback UI with retry button', () => {
      const boundary = new ErrorBoundary({
        fallbackTitle: 'Gagal Memuat Percakapan',
        children: <div />,
      })
      const error = new Error('Simulated Component Crash!')

      const derived = ErrorBoundary.getDerivedStateFromError(error)
      expect(derived.hasError).toBe(true)
      expect(derived.error).toBe(error)

      boundary.state = derived
      const rendered = boundary.render() as React.ReactElement
      const html = renderToString(rendered)

      expect(html).toContain('Gagal Memuat Percakapan')
      expect(html).toContain('Muat Ulang Komponen')
      expect(html).not.toContain('Normal Content Loaded')
    })

    it('should support root variant with full screen error layout', () => {
      const boundary = new ErrorBoundary({ variant: 'root', children: <div /> })
      const error = new Error('Simulated App Crash!')

      boundary.state = ErrorBoundary.getDerivedStateFromError(error)
      const rendered = boundary.render() as React.ReactElement
      const html = renderToString(rendered)

      expect(html).toContain('Terjadi Kesalahan pada Aplikasi')
      expect(html).toContain('Muat Ulang Halaman')
      expect(html).toContain('Simulated App Crash!')
    })

    it('should support resetErrorBoundary to clear error state', () => {
      const onReset = mock(() => {})
      const boundary = new ErrorBoundary({ onReset, children: <div /> })
      boundary.state = { hasError: true, error: new Error('Error') }

      boundary.resetErrorBoundary()
      expect(boundary.state.hasError).toBe(false)
      expect(boundary.state.error).toBeNull()
      expect(onReset).toHaveBeenCalledTimes(1)
    })
  })

  describe('2. PageSkeleton Component for Suspense Fallback', () => {
    it('should render skeleton loading placeholders with pulse animation', () => {
      const html = renderToString(<PageSkeleton title="Memuat Halaman..." />)
      expect(html).toContain('animate-pulse')
      expect(html).toContain('Memuat Halaman...')
    })
  })

  describe('3. Route-Based Code Splitting & Panel Isolation Verification', () => {
    it('should verify WhatsAppLayout encapsulates active chat thread in ErrorBoundary', async () => {
      const { readFileSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      const layoutFile = readFileSync(
        resolve(import.meta.dir, '../layout/WhatsAppLayout.tsx'),
        'utf-8',
      )
      expect(layoutFile).toContain('<ErrorBoundary')
      expect(layoutFile).toContain('fallbackTitle="Gagal memuat percakapan"')
    })

    it('should verify App.tsx implements React.lazy and Suspense fallback', async () => {
      const { readFileSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      const appFile = readFileSync(resolve(import.meta.dir, '../../App.tsx'), 'utf-8')
      expect(appFile).toContain('lazy(')
      expect(appFile).toContain('<Suspense')
      expect(appFile).toContain('<ErrorBoundary variant="root">')
    })
  })
})
