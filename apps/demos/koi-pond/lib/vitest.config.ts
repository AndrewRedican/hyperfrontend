import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // why: The lib is framework-free maths with no DOM surface, so a node environment keeps the suite fast.
    environment: 'node',
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
})
