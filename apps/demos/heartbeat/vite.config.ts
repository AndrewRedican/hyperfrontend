import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // note: Apps emit into the workspace dist tree mirroring their source path, like library packages do.
    outDir: '../../../dist/apps/demos/heartbeat/app',
    emptyOutDir: true,
    rollupOptions: {
      // note: Two pages, one origin — the React feature at `/` and the vanilla host at `/host/`.
      input: {
        feature: fileURLToPath(new URL('./index.html', import.meta.url)),
        host: fileURLToPath(new URL('./host/index.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
