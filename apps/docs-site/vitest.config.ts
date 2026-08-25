import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(createURL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
})
