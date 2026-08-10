import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // why: One port above the pond's own dev entry, so the workbench and the pond can run side by side.
    port: 4283,
  },
  build: {
    // why: Deliberately outside `site/`, because the workbench is a development tool and must never reach a deploy.
    outDir: '../../../../dist/apps/demos/koi-pond/workbench',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // why: The workbench reads the koi lib's TypeScript sources, not its packed tarball — editing a mesh generator has to hot-reload in the browser without a rebuild-repack-reinstall round trip.
      '@hyperfrontend/demo-koi-lib/three': fileURLToPath(new URL('../lib/src/three/index.ts', import.meta.url)),
      '@hyperfrontend/demo-koi-lib': fileURLToPath(new URL('../lib/src/index.ts', import.meta.url)),
    },
  },
})
