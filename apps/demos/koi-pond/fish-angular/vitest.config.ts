import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      setupFiles: ['src/test-setup.ts'],
      // why: The Angular plugin defaults the pool to vmThreads for zone.js fakeAsync support; this app is zoneless, and the VM pool's module registry cannot digest the shared lib's ESM-in-CJS dependency.
      pool: 'forks',
    },
  })
)
