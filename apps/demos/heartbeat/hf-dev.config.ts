import { defineDevConfig } from '@hyperfrontend/features'

export default defineDevConfig({
  apps: [
    {
      name: '@hyperfrontend/demo-heartbeat',
      outputDir: '../../../dist/apps/demos/heartbeat/app',
      // why: Pinned beside the clock demo's 4280 so both demos can run at once, and clear of Next dev's default 3000.
      port: 4281,
    },
  ],
})
