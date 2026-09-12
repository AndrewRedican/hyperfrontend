import { dialStage } from '../src/dial/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('time-utils')

/**
 * The same thirty seconds, interrupted, twice.
 *
 * `setTimeout` has no opinion about being interrupted, and that is the whole
 * gap this package fills. Two identical idle countdowns drain side by side as
 * rings; nine seconds in, a dialog slides over both, and one ring keeps
 * emptying under it toward signing the reader out while the other holds where
 * it was and continues from there once the dialog is gone. Nothing about that
 * difference can be stated in a sentence as quickly as it can be watched.
 *
 * The pause is not a smaller timeout restarted. `createTimer` banks what was
 * left (`remaining -= dateNow() - start`), so what resumes is the remainder,
 * which is why the right-hand dial picks up at twenty-one and not at thirty.
 *
 * Verified against `libs/utils/time/src/create-timer.ts`: the `Timer` surface
 * is `pause`, `resume` and `reset(newDelay?)`, and the remaining time is banked
 * on pause by subtracting the elapsed span from what was left.
 */
export default defineScriptedScene({
  slug: 'time-utils-countdown',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: dialStage,
  holdMs: 1_800,
  gif: { colours: 48, lossy: 40, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 4_600, format: 'webp', quality: 82, maxBytes: 60_000 }],
  config: {
    restMs: 1_600,
    overlay: { atMs: 3_300, untilMs: 6_300, title: 'Still there?', detail: 'Your session is about to end.', action: 'Keep me signed in' },
    dials: [
      {
        title: 'setTimeout(signOut, 30_000)',
        max: 30,
        unit: 's',
        decimals: 1,
        tone: 'danger',
        stops: [
          { atMs: 600, value: 30 },
          { atMs: 9_600, value: 0 },
        ],
        states: [{ atMs: 3_300, untilMs: 9_600, label: 'still counting', tone: 'danger' }],
        outcome: 'signed out mid-dialog',
        outcomeTone: 'danger',
      },
      {
        title: 'createTimer(signOut, 30_000)',
        mark: identity.mark,
        max: 30,
        unit: 's',
        decimals: 1,
        tone: 'success',
        stops: [
          { atMs: 600, value: 30 },
          { atMs: 3_300, value: 21 },
          { atMs: 6_300, value: 21 },
          { atMs: 12_600, value: 0 },
        ],
        states: [
          { atMs: 3_300, untilMs: 6_300, label: 'paused at 21.0s', tone: 'success' },
          { atMs: 6_300, untilMs: 8_300, label: 'resumed from 21.0s', tone: 'success' },
        ],
        outcome: 'the full thirty, honoured',
        outcomeTone: 'success',
      },
    ],
  },
})
