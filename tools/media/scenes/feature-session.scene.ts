import { embedStage } from '../src/embed/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('features')

/**
 * What happens when a host mounts a feature, drawn rather than logged.
 *
 * A feature window slides out of its own space into the slot the host holds
 * for it. Three dots cross the dashed wire, one each way and one back, and on
 * the third the wire goes solid: that is nexus's three-way handshake
 * (`connection-request`, `connection-request-accepted`, `connection-opened`).
 * The host then measures the slot, a bracket draws around it with the size,
 * and a dot carries that size across: the presentation announcement, which is
 * queued before the channel even connects so it is the first thing the
 * feature hears, and why the feature's content only fills its frame once it
 * has been told the frame. Small dots then leave the feature once a second,
 * the host's lamp turns green on the first, and finally the feature says the
 * one thing either side actually wanted to say, and a receipt pops on the
 * host.
 *
 * Verified against `libs/nexus/src/types/action.ts` (the handshake actions),
 * `libs/features/src/host/lifecycle.ts` (the announcement queued ahead of
 * `connect()` with the host-measured viewport) and
 * `libs/features/src/hostee/heartbeat.ts` (the one-second cadence).
 */
export default defineScriptedScene({
  slug: 'feature-session',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: embedStage,
  holdMs: 1_800,
  gif: { colours: 128, lossy: 0, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 9_500, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    shellApi: 'createShell',
    featureApi: 'createFeature',
    closeApi: 'close()',
    restMs: 1_000,
    script: [
      { kind: 'dock', atMs: 0, durationMs: 1_300 },
      { kind: 'pulse', atMs: 1_500, from: 'host' },
      { kind: 'pulse', atMs: 2_400, from: 'feature' },
      { kind: 'pulse', atMs: 3_300, from: 'host' },
      { kind: 'link', atMs: 4_000 },
      { kind: 'present', atMs: 4_600, width: 720, height: 540 },
      { kind: 'beat', atMs: 6_000, everyMs: 1_000, untilMs: 9_000 },
      { kind: 'message', atMs: 8_600, from: 'feature', label: 'order-placed' },
    ],
  },
})
