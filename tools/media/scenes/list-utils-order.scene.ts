import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * Two lists, the same three objects, and two opposite answers.
 *
 * The columns are loaded in lockstep: the same three pushes type themselves out
 * at the same moments on both sides, so the only thing that can explain what
 * happens next is which factory made the list. Then both drain, `pull()` by
 * `pull()`, and the values come back `1, 2, 3` on the left and `3, 2, 1` on the
 * right. The middle object is the same in both columns, which is the honest
 * shape of the difference: only the ends swap.
 *
 * The closing three rows are the part that catches people out. Both lists are
 * empty by then, a fresh `{ id: 1 }` is pushed, and `has({ id: 1 })` written
 * with the very same literal answers false. Membership is a `Set` of the
 * references you handed over, so an object that merely looks the same was never
 * in the list; `has()` and `remove()` want the reference back. The heading says
 * objects only because the guard is a runtime one rather than a typing one: the
 * push is checked with `getType`, and a string, a number, `null` and even an
 * array all throw.
 *
 * Verified against `libs/utils/list/src/create-fifo-list.ts` (the factory name,
 * the method surface, and `pull()` reading the front of the set),
 * `libs/utils/list/src/create-lifo-list.ts` (`pull()` popping the back of the
 * same structure), both `.spec.ts` files beside them (the drain order, and
 * `has({})` returning false while an identical empty object is in the list),
 * `libs/utils/list/src/index.ts` (both factories are exported) and
 * `libs/utils/data/src/get-type.ts` (why a primitive never gets in).
 */
export default defineScriptedScene({
  slug: 'list-utils-order',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 184,
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 72, maxBytes: 850_000 },
  stills: [{ name: 'poster', atMs: 7_800, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    heading: 'Objects only, held by reference: same three in, opposite three out.',
    caption: 'An entry is the object you pushed; one that merely looks the same is a different entry.',
    restMs: 1_500,
    panels: [
      {
        title: 'const jobs = createFifoList()',
        kind: 'code',
        rows: [
          { text: 'jobs.push({ id: 1 })', atMs: 260, typeMs: 480 },
          { text: 'jobs.push({ id: 2 })', atMs: 840, typeMs: 420 },
          { text: 'jobs.push({ id: 3 })', atMs: 1_360, typeMs: 420 },
          { text: 'jobs.pull()', atMs: 2_200, untilMs: 2_640, typeMs: 320 },
          { text: 'jobs.pull()          { id: 1 }', atMs: 2_640, tone: 'accent' },
          { text: 'jobs.pull()', atMs: 3_180, untilMs: 3_580, typeMs: 320 },
          { text: 'jobs.pull()          { id: 2 }', atMs: 3_580, tone: 'accent' },
          { text: 'jobs.pull()', atMs: 4_120, untilMs: 4_520, typeMs: 320 },
          { text: 'jobs.pull()          { id: 3 }', atMs: 4_520, tone: 'accent' },
          { text: 'jobs.push({ id: 1 })', atMs: 5_600, typeMs: 460 },
          { text: 'jobs.has({ id: 1 })', atMs: 6_300, typeMs: 440 },
          { text: 'false', atMs: 7_100, marker: '›', tone: 'warning', emphasis: true },
        ],
      },
      {
        title: 'const jobs = createLifoList()',
        kind: 'code',
        rows: [
          { text: 'jobs.push({ id: 1 })', atMs: 260, typeMs: 480 },
          { text: 'jobs.push({ id: 2 })', atMs: 840, typeMs: 420 },
          { text: 'jobs.push({ id: 3 })', atMs: 1_360, typeMs: 420 },
          { text: 'jobs.pull()', atMs: 2_200, untilMs: 2_640, typeMs: 320 },
          { text: 'jobs.pull()          { id: 3 }', atMs: 2_640, tone: 'accent' },
          { text: 'jobs.pull()', atMs: 3_180, untilMs: 3_580, typeMs: 320 },
          { text: 'jobs.pull()          { id: 2 }', atMs: 3_580, tone: 'accent' },
          { text: 'jobs.pull()', atMs: 4_120, untilMs: 4_520, typeMs: 320 },
          { text: 'jobs.pull()          { id: 1 }', atMs: 4_520, tone: 'accent' },
          { text: 'jobs.push({ id: 1 })', atMs: 5_600, typeMs: 460 },
          { text: 'jobs.has({ id: 1 })', atMs: 6_300, typeMs: 440 },
          { text: 'false', atMs: 7_100, marker: '›', tone: 'warning', emphasis: true },
        ],
      },
    ],
  },
})
