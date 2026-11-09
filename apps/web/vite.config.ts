import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiPort = process.env.PORT_API || process.env.PORT || '3000'
const webPort = Number(process.env.PORT_WEB || 5173)
const webHost = process.env.HOST || '0.0.0.0'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router')
          ) {
            return 'vendor-react'
          }
          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-lucide'
          }
          if (id.includes('AnalyticsPage')) return 'page-analytics'
          if (id.includes('CampaignsPage')) return 'page-campaigns'
          if (id.includes('AutomationRulesPage')) return 'page-automation'
          if (id.includes('EnterpriseSecurityPage')) return 'page-security'
          if (id.includes('HelpCenterPage')) return 'page-helpcenter'
          if (id.includes('ChannelWizardPage')) return 'page-channelwizard'
          if (id.includes('AiProviderSettingsPage')) return 'page-ai-settings'
          if (id.includes('CsatSurveyPage')) return 'page-csat'
          if (id.includes('SetupPage')) return 'page-setup'
        },
      },
    },
  },
  server: {
    host: webHost,
    port: webPort,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
})
