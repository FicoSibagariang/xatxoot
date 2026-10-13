import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  AiProviderConfigPanel,
  type AiProviderConfigPanelProps,
  type AiProviderFormData,
  type EmbeddingSyncStatus,
  type TestConnectionResult,
} from './AiProviderConfigPanel'

describe('AI Provider Configuration Panel (Task 5.15 - apps/web)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')

  const defaultFormData: AiProviderFormData = {
    provider: 'openai',
    modelName: 'gpt-4o',
    apiKey: 'sk-proj-test1234567890',
    baseUrl: '',
    temperature: 0.7,
    active: true,
  }

  const defaultSyncStatus: EmbeddingSyncStatus = {
    totalArticles: 14,
    totalChunks: 58,
    vectorDimension: 1536,
    lastSyncedAt: '2026-10-13T10:00:00.000Z',
    isSyncing: false,
  }

  describe('1. Panel Rendering & Form Fields', () => {
    it('should render panel header and all 4 supported AI providers', () => {
      const html = renderToStaticMarkup(
        <AiProviderConfigPanel
          initialData={defaultFormData}
          onSave={() => {}}
          onTestConnection={async () => ({
            success: true,
            message: 'OK',
            latencyMs: 120,
            replyText: 'Siap!',
          })}
          onSyncEmbeddings={async () => ({ totalArticles: 14, totalChunks: 58 })}
        />,
      )

      expect(html).toContain('data-testid="ai-provider-config-panel"')
      expect(html).toContain('Konfigurasi AI Provider &amp; Copilot')
      expect(html).toContain('data-testid="provider-card-openai"')
      expect(html).toContain('data-testid="provider-card-gemini"')
      expect(html).toContain('data-testid="provider-card-anthropic"')
      expect(html).toContain('data-testid="provider-card-ollama"')
    })

    it('should render model name input, preset options, and temperature slider', () => {
      const html = renderToStaticMarkup(
        <AiProviderConfigPanel initialData={defaultFormData} onSave={() => {}} />,
      )

      expect(html).toContain('data-testid="input-model-name"')
      expect(html).toContain('data-testid="model-presets"')
      expect(html).toContain('data-testid="input-temperature"')
      expect(html).toContain('data-testid="toggle-active-status"')
      expect(html).toContain('data-testid="btn-save-ai-setting"')
    })

    it('should render API key input with toggle visibility button and masked state', () => {
      const html = renderToStaticMarkup(
        <AiProviderConfigPanel
          initialData={{
            ...defaultFormData,
            apiKeyEncrypted: 'enc:7890',
          }}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="input-api-key"')
      expect(html).toContain('data-testid="btn-toggle-apikey-visibility"')
      expect(html).toContain('data-testid="api-key-masked-hint"')
    })

    it('should show base URL input and recommendation notice when Ollama provider is selected', () => {
      const html = renderToStaticMarkup(
        <AiProviderConfigPanel
          initialData={{
            ...defaultFormData,
            provider: 'ollama',
            modelName: 'llama3:8b',
            apiKey: '',
            baseUrl: 'http://localhost:11434',
          }}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="input-base-url"')
      expect(html).toContain('data-testid="ollama-notice"')
      expect(html).toContain('http://localhost:11434')
    })
  })

  describe('2. Prompt Connection Test (Tes Koneksi Prompt)', () => {
    it('should render prompt test input and test connection button', () => {
      const html = renderToStaticMarkup(
        <AiProviderConfigPanel initialData={defaultFormData} onSave={() => {}} />,
      )

      expect(html).toContain('data-testid="section-test-connection"')
      expect(html).toContain('data-testid="input-test-prompt"')
      expect(html).toContain('data-testid="btn-test-ai-connection"')
      expect(html).toContain('Tes Koneksi Prompt')
    })

    it('should render test loading indicator when isTestingConnection is true', () => {
      const html = renderToStaticMarkup(
        <AiProviderConfigPanel
          initialData={defaultFormData}
          isTestingConnection={true}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="test-connection-loading"')
      expect(html).toContain('Menguji koneksi ke AI Provider...')
    })

    it('should render test result card with success badge, latency, and AI response', () => {
      const mockResult: TestConnectionResult = {
        success: true,
        message: 'Koneksi ke OpenAI berhasil diverifikasi.',
        latencyMs: 148,
        replyText: 'Halo! Koneksi AI Copilot Xatxoot aktif dan siap digunakan.',
      }

      const html = renderToStaticMarkup(
        <AiProviderConfigPanel
          initialData={defaultFormData}
          testResult={mockResult}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="test-connection-result"')
      expect(html).toContain('data-testid="test-connection-badge"')
      expect(html).toContain('148 ms')
      expect(html).toContain('data-testid="test-connection-reply"')
      expect(html).toContain('Halo! Koneksi AI Copilot Xatxoot aktif dan siap digunakan.')
    })

    it('should render error banner when test connection fails', () => {
      const mockFailedResult: TestConnectionResult = {
        success: false,
        message: 'Autentikasi gagal: API Key tidak valid (401 Unauthorized)',
        latencyMs: 310,
      }

      const html = renderToStaticMarkup(
        <AiProviderConfigPanel
          initialData={defaultFormData}
          testResult={mockFailedResult}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="test-connection-error"')
      expect(html).toContain('401 Unauthorized')
    })
  })

  describe('3. Knowledge Base Embedding Synchronization (Sinkronisasi Embedding)', () => {
    it('should render embedding sync section with statistics and sync button', () => {
      const html = renderToStaticMarkup(
        <AiProviderConfigPanel
          initialData={defaultFormData}
          syncStatus={defaultSyncStatus}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="section-sync-embeddings"')
      expect(html).toContain('data-testid="stat-indexed-articles"')
      expect(html).toContain('14')
      expect(html).toContain('data-testid="stat-total-chunks"')
      expect(html).toContain('58')
      expect(html).toContain('data-testid="stat-vector-dimension"')
      expect(html).toContain('1536')
      expect(html).toContain('data-testid="btn-sync-embeddings"')
      expect(html).toContain('Sinkronkan Sekarang')
    })

    it('should render syncing progress indicator when isSyncing is true', () => {
      const html = renderToStaticMarkup(
        <AiProviderConfigPanel
          initialData={defaultFormData}
          syncStatus={{
            ...defaultSyncStatus,
            isSyncing: true,
          }}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="sync-embeddings-loading"')
      expect(html).toContain('Sedang menyinkronkan vector embeddings...')
    })

    it('should render sync success feedback message when provided', () => {
      const html = renderToStaticMarkup(
        <AiProviderConfigPanel
          initialData={defaultFormData}
          syncFeedback="Sinkronisasi berhasil! 14 artikel dan 58 chunk vektor telah diperbarui."
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="sync-embeddings-success"')
      expect(html).toContain('Sinkronisasi berhasil!')
    })
  })

  describe('4. Single Organization Guardrail & Phase 5 Checklist', () => {
    it('should strictly NOT contain or require account_id or accountId in props or components', () => {
      const componentSource = readFileSync(join(__dirname, 'AiProviderConfigPanel.tsx'), 'utf-8')
      expect(componentSource).not.toContain('account_id')
      expect(componentSource).not.toContain('accountId')
    })

    it('should verify docs/PHASE_5_CHECKLIST.md marks Task 5.15 as completed', () => {
      const checklist = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklist).toContain('- [x] **Task 5.15**:')
    })
  })
})
