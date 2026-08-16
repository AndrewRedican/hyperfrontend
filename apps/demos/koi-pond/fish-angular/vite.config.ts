import { fileURLToPath, URL } from 'node:url'

import angular from '@analogjs/vite-plugin-angular'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // why: Relative asset URLs serve the koi both composed under the pond's sub-path and standalone at its own origin's root, so one build deploys to either topology.
  base: './',
  // why: The Angular compiler must run under an emitting tsconfig — the app config's noEmit would have every module compile to nothing.
  plugins: [angular({ tsconfig: 'tsconfig.angular.json' })],
  build: {
    // note: Apps emit into the workspace dist tree mirroring their source path, like library packages do.
    outDir: '../../../../dist/apps/demos/koi-pond/site/fish-angular',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
