/**
 * Host integration for the "@hyperfrontend/demo-heartbeat" feature.
 *
 * Wires this app to its host: the rhythm engine's beats and state changes
 * stream out as contract events, `ping` requests are answered with `pong`,
 * and `set-rate` commands repace the baseline. Scaffolded by `hf init`,
 * then filled in by hand.
 *
 * @module @hyperfrontend/demo-heartbeat.feature
 */
import { createFeature } from '@hyperfrontend/features/hostee'
import contract from '../heartbeat.contract'
import { wireHeartbeatContract } from './feature/wire-contract'
import { heartRhythm } from './state/heart-rhythm'

/** The @hyperfrontend/demo-heartbeat feature handle; use it to send and receive contract actions. */
export const feature = createFeature({
  name: '@hyperfrontend/demo-heartbeat',
  contract,
  // why: In features@0.4.0 the SDK's payload-less `__hf:beat` cannot cross the v1 envelope (the packet layer rejects empty data), which pins every host watchdog at `suspect`. This demo exists to show the watchdog working, so the same-origin pairing runs unenveloped.
  protocol: 'none',
})

wireHeartbeatContract(feature, heartRhythm)

// why: The heart beats standalone too — the engine starts at boot, and beats emitted before a host connects simply never leave the frame.
heartRhythm.start()

void feature.ready().then(() => {
  // why: The host joins mid-rhythm; announcing the current state means its readouts need not wait for the next transition.
  feature.send('rhythm', { state: heartRhythm.getState(), bpm: Math.round(heartRhythm.getPacingBpm()) })
})
