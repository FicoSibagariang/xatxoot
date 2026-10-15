import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiPort = process.env.PORT_API || process.env.PORT || '3000'
const webPort = Number(process.env.PORT_WEB || 5173)

export default defineConfig({
  plugins: [react()],
  server: {
    port: webPort,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
})
