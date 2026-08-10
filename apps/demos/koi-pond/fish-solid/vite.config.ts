import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// https://vite.dev/config/
export default defineConfig({
  // why: Relative asset URLs serve the koi both composed under the pond's sub-path and standalone at its own origin's root, so one build deploys to either topology.
  base: './',
  plugins: [solid()],
  build: {
    // note: Apps emit into the workspace dist tree mirroring their source path, like library packages do.
    outDir: '../../../../dist/apps/demos/koi-pond/site/fish-solid',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
