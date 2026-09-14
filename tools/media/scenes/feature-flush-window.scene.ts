import { embedStage } from '../src/embed/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('features')

/**
 * Closing is a duration, and the draft gets out through it.
 *
 * The seated feature holds a draft with an amber marker, and tells the host
 * so: an amber dot crosses and the host's lamp takes the colour. The host
 * presses `close()` and a dot carries the proposal across. A shutter comes
 * down over the wire and stops part way: the wire under it turns amber and
 * both windows' borders with it, because the channel is closing and still
 * delivering. The draft leaves the feature, passes through the gap and lands
 * in the host with a green check, and the amber clears on both sides. Only
 * then does the acknowledgement cross back, the shutter finish its descent,
 * the wire go dead and the feature fade out of the slot.
 *
 * Verified against `libs/nexus/src/broker/routing/handle-close.ts` (`closing`
 * fires while the channel is still active so subscribers can flush, then
 * `connection-closed-acknowledged` is sent and the channel disconnects) and
 * `libs/features/src/shared/control.ts` (`__hf:dirty` is the feature's own
 * declaration that it holds unsaved work).
 */
export default defineScriptedScene({
  slug: 'feature-flush-window',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: embedStage,
  holdMs: 1_800,
  gif: { colours: 128, lossy: 0, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 3_750, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    shellApi: 'createShell',
    featureApi: 'createFeature',
    closeApi: 'close()',
    restMs: 800,
    script: [
      { kind: 'link', atMs: 0, flash: false },
      { kind: 'dirty', atMs: 400, on: true, flightMs: 650 },
      { kind: 'close', atMs: 1_400, flightMs: 800 },
      { kind: 'gate', atMs: 2_300, to: 0.6 },
      { kind: 'draft', atMs: 3_200 },
      { kind: 'pulse', atMs: 5_200, from: 'feature', flightMs: 800 },
      { kind: 'gate', atMs: 6_100, to: 1 },
      { kind: 'undock', atMs: 6_600 },
    ],
  },
})
