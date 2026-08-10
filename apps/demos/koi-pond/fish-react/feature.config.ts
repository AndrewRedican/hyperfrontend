import { defineConfig } from '@hyperfrontend/features'

export default defineConfig({
  name: '@hyperfrontend/demo-koi-fish-react',
  // note: The version tracks the shared koi contract's version; the shell build requires the two to agree.
  version: '0.2.0',
  contract: './koi-fish.contract.ts',
  url: 'https://demo-koi-fish-react-production.up.railway.app/',
  // why: An open shell, acknowledged at pack time - seven koi share one page reporting outlines at high cadence, and a per-message security envelope across seven channels collapses delivery. Messages still pin to the configured origin.
  protocol: 'none',
  display: {
    // note: Embedded is the koi's real presentation - a host-owned transparent layer. The shell build only compiles with the full mode set declared, and the windowed modes let debug consoles inspect a single koi.
    modes: ['embedded', 'dialog', 'popup', 'standalone'],
    dialog: { width: 640, height: 480 },
    popup: { width: 640, height: 480 },
  },
})
