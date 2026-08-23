/**
 * Host integration for the "@hyperfrontend/demo-koi-fish-svelte" feature.
 *
 * Creates the handle this koi speaks the pond's contract over. The runtime
 * wires the contract to itself the moment it is born with this handle, so the
 * world, its identity, relayed neighbours, disturbances, depth grants, and
 * hover notices arrive as accepted actions, and its outline, depth requests,
 * ripple requests, and settled notices leave as emitted ones.
 *
 * @module @hyperfrontend/demo-koi-fish-svelte.feature
 */
import { koiFishContract } from '@hyperfrontend/demo-koi-lib/contract'
import { createFeature } from '@hyperfrontend/features/hostee'
import type { FeatureContract } from '@hyperfrontend/features/hostee'

/** The koi feature handle; use it to send and receive contract actions. */
export const feature = createFeature({
  name: '@hyperfrontend/demo-koi-fish-svelte',
  // why: The shared lib declares the contract structurally so it stays SDK-free; this is where the nine consumers each check it against the real type.
  contract: <FeatureContract>koiFishContract,
  // why: No security protocol on purpose, matching the shell this koi packs as - eight koi report outlines at high cadence on one page, and a per-message security envelope across eight channels collapses delivery. Messages still pin to the host's origin.
})
