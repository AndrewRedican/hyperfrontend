import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // note: Lit needs no build-time plugin — its templates are plain tagged literals and its styles are plain constructable stylesheets.
  plugins: [],
  // why: The koi is served from a sub-path of the pond's single origin, so its asset URLs must be rooted there in dev and in production alike.
  base: '/fish-lit/',
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
