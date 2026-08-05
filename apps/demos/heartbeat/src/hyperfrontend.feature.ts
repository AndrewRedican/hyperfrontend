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
import { featureUi } from './state/feature-ui'
import { heartRhythm } from './state/heart-rhythm'

/** The @hyperfrontend/demo-heartbeat feature handle; use it to send and receive contract actions. */
export const feature = createFeature({
  name: '@hyperfrontend/demo-heartbeat',
  contract,
  protocol: 'v1',
})

wireHeartbeatContract(feature, heartRhythm)

// why: The dialog chrome and the standalone sound path both key off the host's presentation announcements — never off URLs or frame ancestry.
featureUi.attach(feature)

// why: The heart beats standalone too — the engine starts at boot, and beats emitted before a host connects simply never leave the frame.
heartRhythm.start()

void feature.ready().then(() => {
  // why: The host joins mid-rhythm; announcing the current state means its readouts need not wait for the next transition.
  feature.send('rhythm', { state: heartRhythm.getState(), bpm: Math.round(heartRhythm.getPacingBpm()) })
})
