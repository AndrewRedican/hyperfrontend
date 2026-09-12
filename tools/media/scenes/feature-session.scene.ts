import { flowStage } from '../src/flow/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * What actually happens between a host page and a feature it mounts.
 *
 * Every name on the wire is the real one. The three-way handshake is nexus's
 * (`connection-request` carrying the host's contract, `connection-request-accepted`
 * carrying the feature's, then `connection-opened`, which is where contract
 * compatibility is decided). Everything after it is this package's reserved
 * control plane: `__hf:present` is queued before the channel connects so it is
 * the first message the feature receives, and it carries the display mode and
 * the frame's measured pixel size rather than leaving the feature to guess;
 * `__hf:beat` is the feature's own liveness pulse on a fixed one-second
 * cadence, which the host counts and stops trusting after three misses.
 *
 * The one thing here that is not a message is the `order-placed` line, and that
 * is the point of the whole exchange: everything above it is the session being
 * established, and it is the first thing either app actually wanted to say.
 *
 * Verified against `libs/nexus/src/types/action.ts` (the wire names),
 * `libs/features/src/shared/control.ts` (the control types),
 * `libs/features/src/host/lifecycle.ts` (present queued ahead of connect) and
 * `libs/features/src/hostee/heartbeat.ts` (the one-second cadence).
 */
export default defineScriptedScene({
  slug: 'feature-session',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 217,
  stage: flowStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 75, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 9_400, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    left: { title: 'Host', subtitle: 'shop.example.com', note: 'createShell({ modes })' },
    right: { title: 'Feature', subtitle: 'checkout.example.com', note: 'createFeature({ contract })' },
    phases: [
      { atMs: 0, label: 'Handshake' },
      { atMs: 4_600, label: 'Presentation' },
      { atMs: 6_600, label: 'Session' },
    ],
    settled: 'One typed channel. Anything off the contract never reaches your handler.',
    restMs: 1_600,
    messages: [
      {
        from: 'left',
        label: '[nexus] connection-request',
        detail: 'the host contract, and the origin it will pin to',
        atMs: 500,
        flightMs: 850,
        tone: 'muted',
      },
      {
        from: 'right',
        label: '[nexus] connection-request-accepted',
        detail: 'the feature contract, and its display modes',
        atMs: 1_900,
        flightMs: 850,
        tone: 'muted',
      },
      {
        from: 'left',
        label: '[nexus] connection-opened',
        detail: 'contracts checked, channel open',
        atMs: 3_300,
        flightMs: 850,
        tone: 'accent',
      },
      {
        from: 'left',
        label: '__hf:present',
        detail: 'mode: dialog, viewport: 720 x 540',
        atMs: 4_800,
        flightMs: 800,
        tone: 'accent',
      },
      {
        from: 'right',
        label: '__hf:beat',
        detail: 'every 1s, three misses and the host stops trusting it',
        atMs: 6_200,
        flightMs: 620,
        repeatEveryMs: 1_000,
        repeatUntilMs: 10_200,
        tone: 'muted',
      },
      {
        from: 'right',
        label: 'order-placed',
        detail: "{ id: 'A-1094' }",
        atMs: 8_900,
        flightMs: 800,
        tone: 'success',
      },
    ],
  },
})
