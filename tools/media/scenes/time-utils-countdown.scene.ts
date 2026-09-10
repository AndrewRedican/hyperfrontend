import { gaugeStage } from '../src/gauge/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * The same thirty seconds, interrupted, twice.
 *
 * `setTimeout` has no opinion about being interrupted, and that is the whole
 * gap this package fills. Two identical idle countdowns run side by side; nine
 * seconds in, the reader does something, and one of them keeps counting toward
 * signing them out while the other holds where it was and continues from there
 * afterwards. Nothing about that difference can be stated in a sentence as
 * quickly as it can be watched.
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
  stage: gaugeStage,
  holdMs: 1_800,
  gif: { colours: 40, lossy: 80, maxBytes: 700_000 },
  stills: [{ name: 'poster', atMs: 7_600, format: 'webp', quality: 82, maxBytes: 60_000 }],
  config: {
    theme: 'midnight',
    heading: 'A dialog opens at 9s. One countdown notices.',
    caption: 'resume() continues the remainder. It does not start a new thirty seconds.',
    stacked: true,
    restMs: 1_700,
    groups: [
      {
        title: 'setTimeout(signOut, 30_000)',
        tracks: [
          {
            label: 'time left',
            max: 30,
            unit: 's',
            decimals: 1,
            tone: 'danger',
            note: 'kept counting through the interruption, then signed the reader out',
            stops: [
              { atMs: 600, value: 30 },
              { atMs: 9_600, value: 0 },
            ],
          },
        ],
      },
      {
        title: 'createTimer(signOut, 30_000)',
        tracks: [
          {
            label: 'time left',
            max: 30,
            unit: 's',
            decimals: 1,
            tone: 'success',
            note: 'pause() at 9s, resume() at 12s, and the remainder is still the remainder',
            stops: [
              { atMs: 600, value: 30 },
              { atMs: 3_300, value: 21 },
              { atMs: 6_300, value: 21 },
              { atMs: 12_600, value: 0 },
            ],
          },
        ],
      },
    ],
  },
})
