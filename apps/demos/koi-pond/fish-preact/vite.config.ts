import { fileURLToPath, URL } from 'node:url'

import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // why: Relative asset URLs serve the koi both composed under the pond's sub-path and standalone at its own origin's root, so one build deploys to either topology.
  base: './',
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
