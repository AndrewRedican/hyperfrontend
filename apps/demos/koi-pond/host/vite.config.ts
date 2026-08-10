import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  build: {
    // note: The pond deploys as one origin — the host owns `/` and each fish owns `/fish-<name>/`, so every app writes into one composed site tree.
    outDir: '../../../../dist/apps/demos/koi-pond/site',
    // why: The fish build into subdirectories of this same tree; emptying it here would delete their output.
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
