import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  optimizeDeps: {
    // Pre-bundle pdfjs so Vite doesn't try to transform the worker at runtime
    include: ['pdfjs-dist'],
  },
  worker: {
    // Use module format so the PDF worker ESM file loads correctly
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the PDF worker in its own chunk to avoid size issues
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
  },
})
