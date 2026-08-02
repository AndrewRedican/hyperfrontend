import { defineDevConfig } from '@hyperfrontend/features'

export default defineDevConfig({
  apps: [
    {
      name: '@hyperfrontend/demo-clock',
      outputDir: '../../../dist/apps/demos/clock/app',
      // why: Pinned so the docs-site's .env.development can point its embed here, and clear of Next dev's default 3000.
      port: 4280,
    },
  ],
})
