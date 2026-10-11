import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'XatxootWidget',
      fileName: (format) => (format === 'iife' ? 'widget.js' : `widget.${format}.js`),
      formats: ['iife', 'es'],
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
    minify: 'esbuild',
    sourcemap: false,
  },
})
