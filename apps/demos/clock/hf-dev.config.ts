import { defineDevConfig } from '@hyperfrontend/features'

export default defineDevConfig({
  apps: [
    {
      name: '@hyperfrontend/demo-clock',
      outputDir: '../../../dist/apps/demos/clock/app',
    },
  ],
})
