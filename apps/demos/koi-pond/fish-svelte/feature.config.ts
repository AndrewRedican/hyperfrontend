import { defineConfig } from '@hyperfrontend/features'

export default defineConfig({
  name: '@hyperfrontend/demo-koi-fish-svelte',
  // note: The version tracks the shared koi contract's version; the shell build requires the two to agree.
  version: '0.4.0',
  contract: './koi-fish.contract.ts',
  url: 'https://demo-koi-fish-svelte-production.up.railway.app/',
  // why: An open shell, acknowledged at pack time - seven koi share one page reporting outlines at high cadence, and a per-message security envelope across seven channels collapses delivery. Messages still pin to the configured origin.
  protocol: 'none',
  display: {
    // note: Embedded is the koi's only presentation - a host-owned transparent layer the pond composites into its scene.
    modes: ['embedded'],
  },
})
