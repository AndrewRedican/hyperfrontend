import { embedStage } from '../src/embed/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('features')

/**
 * Liveness judged, not assumed.
 *
 * The ring beside the host's lamp is the miss budget. Beats arrive and the
 * word inside it says `healthy`. Then the feature goes quiet: each tick of
 * silence fills a segment, and on the third the ring, the word and the
 * feature's border turn to danger, because three ticks without a beat while
 * both pages are visible is `suspect`. One beat clears the whole ring. Then
 * the feature's tab goes to the background: it dims, an eye closes on its
 * chrome, and the ticks keep blinking but fill nothing, because a throttled
 * timer's silence is not evidence and the host says `unobservable`. Coming
 * back opens the eye and empties the budget, but says nothing: the word
 * stays `unobservable` until a beat earns `healthy`, and three more silent
 * ticks reach `suspect` instead.
 *
 * Verified line by line against `libs/features/src/host/heartbeat.ts`: the
 * states are `healthy | unobservable | suspect | gone`, `MISS_THRESHOLD` is 3,
 * the tick returns early while unobservable, `setObservable(true)` resets
 * `missed` without transitioning, and `beat()` only speaks `healthy` when the
 * pair is observable.
 */
export default defineScriptedScene({
  slug: 'feature-watchdog',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: embedStage,
  holdMs: 1_800,
  gif: { colours: 128, lossy: 0, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 11_900, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    shellApi: 'createShell',
    featureApi: 'createFeature',
    closeApi: 'close()',
    restMs: 900,
    script: [
      { kind: 'link', atMs: 0, flash: false },
      { kind: 'status', atMs: 0, state: 'healthy' },
      { kind: 'beat', atMs: 0, everyMs: 900, untilMs: 1_800 },
      { kind: 'tick', atMs: 600, counted: false },
      { kind: 'tick', atMs: 1_500, counted: false },
      { kind: 'tick', atMs: 2_400, counted: false },
      { kind: 'tick', atMs: 3_300, counted: true },
      { kind: 'tick', atMs: 4_200, counted: true },
      { kind: 'tick', atMs: 5_100, counted: true },
      { kind: 'status', atMs: 5_150, state: 'suspect' },
      { kind: 'beat', atMs: 5_400 },
      { kind: 'status', atMs: 5_850, state: 'healthy' },
      { kind: 'tick', atMs: 6_000, counted: false },
      { kind: 'visibility', atMs: 6_300, hidden: true, flightMs: 650 },
      { kind: 'status', atMs: 6_950, state: 'unobservable' },
      { kind: 'tick', atMs: 7_100, counted: false },
      { kind: 'tick', atMs: 7_800, counted: false },
      { kind: 'tick', atMs: 8_700, counted: false },
      { kind: 'visibility', atMs: 8_900, hidden: false, flightMs: 650 },
      { kind: 'tick', atMs: 9_600, counted: true },
      { kind: 'tick', atMs: 10_500, counted: true },
      { kind: 'tick', atMs: 11_400, counted: true },
      { kind: 'status', atMs: 11_450, state: 'suspect' },
    ],
  },
})
