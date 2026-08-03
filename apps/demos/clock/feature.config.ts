import { defineConfig } from '@hyperfrontend/features'

export default defineConfig({
  name: '@hyperfrontend/demo-clock',
  version: '0.2.0',
  contract: './clock.contract.ts',
  url: 'https://demo-clock-production.up.railway.app/',
  protocol: 'v1',
  display: {
    // note: embedded first — an open() without an explicit displayMode embeds; no fixed embedded dimensions, so the iframe fills the host's container.
    modes: ['embedded', 'dialog', 'popup', 'standalone'],
    dialog: { width: 420, height: 420 },
    popup: { width: 480, height: 480 },
  },
})
