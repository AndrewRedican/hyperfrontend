import { defineConfig } from '@hyperfrontend/features'

export default defineConfig({
  name: '@hyperfrontend/demo-koi-fish-lit',
  // note: The version tracks the shared koi contract's version; the shell build requires the two to agree.
  version: '0.8.0',
  contract: './koi-fish.contract.ts',
  url: 'https://demo-koi-fish-lit-production.up.railway.app/',
  // why: An open shell, acknowledged at pack time: the eight koi are same-origin sub-paths of one deploy, so the boundary is the pond's own. Messages still pin to the configured origin.
  protocol: 'none',
  display: {
    // note: Embedded is the koi's only presentation - a host-owned transparent layer the pond composites into its scene.
    modes: ['embedded'],
  },
})
