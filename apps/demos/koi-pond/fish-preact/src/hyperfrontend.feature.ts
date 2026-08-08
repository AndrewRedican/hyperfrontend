/**
 * Host integration for the "@hyperfrontend/demo-koi-fish-preact" feature.
 *
 * Wires this koi to the pond: the world, its identity, relayed neighbours,
 * disturbances, depth grants, and hover notices arrive as accepted actions; its
 * outline, depth requests, ripple requests, and settled notices leave as
 * emitted ones.
 *
 * @module @hyperfrontend/demo-koi-fish-preact.feature
 */
import { koiFishContract } from '@hyperfrontend/demo-koi-lib/contract'
import { createFeature } from '@hyperfrontend/features/hostee'
import type { FeatureContract } from '@hyperfrontend/features/hostee'
import { wireKoiContract } from './feature/wire-contract'
import { koi } from './state/koi'

/** The koi feature handle; use it to send and receive contract actions. */
export const feature = createFeature({
  name: '@hyperfrontend/demo-koi-fish-preact',
  // why: The shared lib declares the contract structurally so it stays SDK-free; this is where the eight consumers each check it against the real type.
  contract: <FeatureContract>koiFishContract,
  // why: No security protocol on purpose - this channel is same-origin inside one deploy, so the envelope deters nothing, and its per-message key derivation collapses delivery when seven channels share one page.
})

wireKoiContract(feature, koi)
