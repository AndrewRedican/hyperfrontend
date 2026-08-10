import { defineConfig } from '@hyperfrontend/features'

export default defineConfig({
  name: '@hyperfrontend/demo-koi-pond',
  version: '0.1.0',
  contract: './koi-pond.contract.ts',
  url: 'https://demo-koi-pond-production.up.railway.app/',
  protocol: 'v1',
  display: {
    // note: Embedded first — an open() without an explicit displayMode embeds; no fixed embedded dimensions, so the iframe fills the host's container.
    modes: ['embedded', 'dialog', 'popup', 'standalone'],
    dialog: { width: 960, height: 640 },
    popup: { width: 1020, height: 700 },
  },
})
