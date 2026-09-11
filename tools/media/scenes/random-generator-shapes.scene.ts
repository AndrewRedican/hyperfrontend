import { gaugeStage } from '../src/gauge/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * The shape `Math.random` cannot make, drawn beside the one it can.
 *
 * A distribution is not a fact you can state in a sentence and have anybody
 * believe: it is a shape, and the only way to show that a bounded Gaussian is
 * a different thing from a uniform draw is to fill two histograms from the
 * same number of samples and let the reader watch one settle into a plateau
 * and the other into a bell. Both bars fill together so the difference is in
 * the shape rather than in the timing.
 *
 * The closing line is the second half of the package and the half that is
 * easier to miss: the same seed opens the same stream, so a whole procedural
 * scene or fixture set is a function of one number.
 *
 * Both histograms are real counts. Four thousand samples were drawn from
 * `createRandomGenerator(2026)` through `uniform(0, 100)` and `gaussian(0, 100)`
 * on 2026-09-10, binned into sixteen, and the totals transcribed here
 * unaltered; `next()` from two generators opened on seed 2026 both returned
 * 0.455408, and seed 2027 returned 0.987989.
 */
export default defineScriptedScene({
  slug: 'random-generator-shapes',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  stage: gaugeStage,
  holdMs: 1_800,
  gif: { colours: 40, lossy: 80, maxBytes: 700_000 },
  stills: [{ name: 'poster', atMs: 4_600, format: 'webp', quality: 82, maxBytes: 60_000 }],
  config: {
    theme: 'midnight',
    heading: 'Four thousand draws. Two shapes.',
    caption: 'Seed 2026 opens the same stream every time: next() is 0.455408, twice.',
    restMs: 1_700,
    groups: [
      {
        title: 'uniform(0, 100)',
        orientation: 'column',
        tracks: bins([258, 240, 258, 258, 261, 235, 260, 224, 234, 244, 249, 248, 246, 237, 258, 290], 'accent'),
      },
      {
        title: 'gaussian(0, 100)',
        orientation: 'column',
        tracks: bins([8, 28, 61, 153, 244, 400, 525, 595, 567, 502, 396, 262, 155, 67, 30, 7], 'success'),
      },
    ],
  },
})

/**
 * Turn a run of bin totals into tracks that fill together.
 *
 * The maximum is shared across both histograms rather than taken per bin, so
 * the two groups are drawn to one scale and the reader is comparing shapes
 * instead of comparing two independently normalised pictures.
 *
 * @param counts - Sample totals, one per bin, in bin order.
 * @param tone - How the bars are coloured.
 * @returns One gauge track per bin.
 */
function bins(counts: readonly number[], tone: 'accent' | 'success') {
  return counts.map((count, index) => ({
    label: index % 4 === 0 ? `${index * 6}` : '',
    max: 600,
    tone,
    stops: [
      { atMs: 600, value: 0 },
      { atMs: 4_600, value: count },
    ],
  }))
}
