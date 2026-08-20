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
  // why: 4280 is also where the debug UI lands by default, and the dev server refuses to start on that collision; the app port is the one the docs-site embed is pinned to, so the debug UI is what moves.
  debug: {
    port: 4291,
  },
})
