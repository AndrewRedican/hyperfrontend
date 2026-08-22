import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // why: Almost every module here is framework-free maths, so a node environment keeps the suite fast; the specs that drive the runtime's browser surface ask for a document of their own.
    environment: 'node',
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
})
