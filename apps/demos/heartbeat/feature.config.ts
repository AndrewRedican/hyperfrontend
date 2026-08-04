import { defineConfig } from '@hyperfrontend/features'

export default defineConfig({
  name: '@hyperfrontend/demo-heartbeat',
  version: '0.1.0',
  contract: './heartbeat.contract.ts',
  url: 'https://demo-heartbeat-production.up.railway.app/',
  // note: Kept in lockstep with the runtime pairing — see the note in src/hyperfrontend.feature.ts for why this demo runs unenveloped.
  protocol: 'none',
  display: {
    // note: Embedded first — an open() without an explicit displayMode embeds; no fixed embedded dimensions, so the iframe fills the host's container.
    modes: ['embedded', 'dialog', 'popup', 'standalone'],
    dialog: { width: 460, height: 540 },
    popup: { width: 520, height: 600 },
  },
})
