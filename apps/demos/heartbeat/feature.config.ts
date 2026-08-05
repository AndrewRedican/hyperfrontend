import { defineConfig } from '@hyperfrontend/features'

export default defineConfig({
  name: '@hyperfrontend/demo-heartbeat',
  version: '0.2.0',
  contract: './heartbeat.contract.ts',
  url: 'https://demo-heartbeat-production.up.railway.app/',
  protocol: 'v1',
  // why: The feature's declared capability request — heartbeat audio wants autoplay delegated to its frame. A host bakes this into the iframe allow list; whether sound actually plays stays behind the host's own explicit user approval.
  permissions: ['autoplay'],
  display: {
    // note: Embedded first — an open() without an explicit displayMode embeds; no fixed embedded dimensions, so the iframe fills the host's container.
    modes: ['embedded', 'dialog', 'popup', 'standalone'],
    dialog: { width: 460, height: 540 },
    popup: { width: 520, height: 600 },
  },
})
