import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * A graph with three back references, and the two ways of asking about them.
 *
 * `JSON.stringify` is where most people meet a circular reference, and what it
 * tells you is the shortest useful thing it could: the one cycle its own walk
 * happened to reach first, drawn as the chain of properties that closes it, and
 * then it throws. There are two more in this graph and nothing about that
 * message says so. So the frame builds the graph on the left, lets stringify
 * fail on the right, and then puts one call under it that returns all three at
 * once, each printed as the path the reference was found at and the path it
 * points back to.
 *
 * The right-hand column is composed as expression and value pairs rather than
 * as a verbatim transcript, in the way the other panel scenes are, but every
 * value in it is real: the `TypeError` and its `--- property 'owner' closes
 * the circle` line are what node 24 prints for exactly these bindings, and the
 * three results are what the library returns for exactly this graph, in this
 * order.
 *
 * The second argument is the whole of the difference and is easy to miss:
 * `maxResults` defaults to 1, so the same call without `'*'` returns a single
 * result and looks no better than the exception it replaced.
 *
 * Verified against `libs/utils/data/src/locate-circular-reference.ts` (the
 * exported name, the `'*'` sentinel and the default of 1),
 * `libs/utils/data/src/circular-reference.ts` (`toString` joining the location
 * and the target with U+00B7 and a spaced arrow, and `depth` as the distance
 * between them), `libs/utils/data/src/locate-circular-reference.spec.ts` (the
 * printed shape, and that `'*'` is what returns more than one) and
 * `libs/utils/data/src/index.ts` (the symbol is on the package's single entry
 * point). Both transcripts were captured from node v24.18.0.
 */
export default defineScriptedScene({
  slug: 'data-utils-circular',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 202,
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 70, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 7_400, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    heading: 'Three back references in one graph. JSON.stringify names one of them.',
    caption: 'One call, every cycle: where each was found, and what it points back to.',
    restMs: 1_500,
    panels: [
      {
        title: 'graph.mjs',
        kind: 'code',
        weight: 0.8,
        rows: [
          { text: "const user = { name: 'alice' }", atMs: 200, typeMs: 620 },
          { text: 'const cart = { owner: user }', atMs: 900, typeMs: 560 },
          { text: 'const line = { buyer: user }', atMs: 1_540, typeMs: 560 },
          { text: '', atMs: 2_160 },
          { text: 'user.cart = cart', atMs: 2_200, typeMs: 340 },
          { text: 'cart.lines = [line]', atMs: 2_600, typeMs: 380 },
          { text: 'line.cart = cart', atMs: 3_040, typeMs: 340 },
          { text: '', atMs: 3_440 },
          { text: 'const state = { user }', atMs: 3_480, typeMs: 440 },
        ],
      },
      {
        title: 'what came back',
        kind: 'result',
        weight: 1.2,
        rows: [
          { text: 'JSON.stringify(state)', atMs: 4_200, tone: 'muted' },
          { text: 'TypeError: Converting circular structure', atMs: 4_700, marker: '›', tone: 'danger' },
          { text: "  --- property 'owner' closes the circle", atMs: 4_850, tone: 'warning' },
          { text: '  one cycle named, then it threw', atMs: 5_000, tone: 'muted' },
          { text: '', atMs: 5_500 },
          { text: "locateCircularReference(state, '*')", atMs: 5_600, tone: 'muted' },
          { text: '  .map(String)', atMs: 5_760, tone: 'muted' },
          { text: "[ 'user·cart·owner → user',", atMs: 6_500, marker: '›', tone: 'accent', emphasis: true },
          { text: "  'user·cart·lines·0·cart → user·cart',", atMs: 6_680, tone: 'accent', emphasis: true },
          { text: "  'user·cart·lines·0·buyer → user' ]", atMs: 6_860, tone: 'accent', emphasis: true },
        ],
      },
    ],
  },
})
