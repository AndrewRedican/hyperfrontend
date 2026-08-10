import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // note: Lit needs no build-time plugin — its templates are plain tagged literals and its styles are plain constructable stylesheets.
  plugins: [],
  // why: Relative asset URLs serve the koi both composed under the pond's sub-path and standalone at its own origin's root, so one build deploys to either topology.
  base: './',
  build: {
    // note: Apps emit into the workspace dist tree mirroring their source path, like library packages do.
    outDir: '../../../../dist/apps/demos/koi-pond/site/fish-lit',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
