/**
 * Host integration for the "@hyperfrontend/demo-clock" feature.
 *
 * Wires this app to its host: every accepted contract action mutates the clock
 * store, store reactions come back as emitted echo events, `get-time` answers
 * correlated requests, and armed alarms report as dirty state. Scaffolded by
 * `hf init`, then filled in by hand.
 *
 * @module @hyperfrontend/demo-clock.feature
 */
import { createFeature } from '@hyperfrontend/features/hostee'
import contract from '../clock.contract'
import { wireClockContract } from './feature/wire-contract'
import { useClockStore } from './state/clock-store'

// why: Lets a host demonstrate the incompatible-contract denial on a real wire —
// loading the feature with ?contract-version=<semver> announces that version at
// the handshake, so a mismatched pairing is refused instead of opening.
const versionOverride = new URLSearchParams(window.location.search).get('contract-version')

/** The @hyperfrontend/demo-clock feature handle; use it to send and receive contract actions. */
export const feature = createFeature({
  name: '@hyperfrontend/demo-clock',
  contract,
  protocol: 'v1',
  ...(versionOverride !== null && { version: versionOverride }),
})

const startTicking = wireClockContract(feature, useClockStore())

void feature.ready().then(() => {
  startTicking()
})
