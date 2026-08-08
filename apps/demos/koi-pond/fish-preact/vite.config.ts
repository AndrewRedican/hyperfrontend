import { fileURLToPath, URL } from 'node:url'

import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // why: The koi is served from a sub-path of the pond's single origin, so its asset URLs must be rooted there in dev and in production alike.
  base: '/fish-preact/',
  plugins: [preact()],
  build: {
    // note: Apps emit into the workspace dist tree mirroring their source path, like library packages do.
    outDir: '../../../../dist/apps/demos/koi-pond/site/fish-preact',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
