import { defineDevConfig } from '@hyperfrontend/features'

export default defineDevConfig({
  apps: [
    {
      name: '@hyperfrontend/demo-koi-pond',
      // why: One composed tree serves the host at `/` and each koi at `/fish-<name>/`, so the dev origin matches the deployed origin exactly.
      outputDir: '../../../../dist/apps/demos/koi-pond/site',
      // why: Pinned past the clock (4280) and heartbeat (4281) demos, and clear of Next dev's default 3000.
      port: 4282,
    },
  ],
  // why: Pinned clear of the whole demo family (clock 4280/4291, heartbeat 4281/4292, workbench 4283) so any of them can run beside the pond.
  debug: {
    port: 4290,
  },
})
