/**
 * Host integration for the "@hyperfrontend/demo-clock" feature (v0.1.0).
 *
 * Wires this app to its host: every accepted contract action mutates the clock
 * store, and store reactions come back as emitted echo events. Scaffolded by
 * `hf init`, then filled in by hand.
 *
 * @module @hyperfrontend/demo-clock.feature
 */
import { createFeature } from '@hyperfrontend/features/hostee'
// note: Path fixed by hand — hf init emitted './clock.contract'.
import contract from '../clock.contract'
import { wireClockContract } from './feature/wire-contract'
import { useClockStore } from './state/clock-store'

/** The @hyperfrontend/demo-clock feature handle; use it to send and receive contract actions. */
export const feature = createFeature({ name: '@hyperfrontend/demo-clock', contract })

const startTicking = wireClockContract(feature, useClockStore())

void feature.ready().then(() => {
  startTicking()
})
