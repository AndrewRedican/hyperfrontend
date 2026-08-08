import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// https://vite.dev/config/
export default defineConfig({
  // why: The koi is served from a sub-path of the pond's single origin, so its asset URLs must be rooted there in dev and in production alike.
  base: '/fish-solid/',
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
