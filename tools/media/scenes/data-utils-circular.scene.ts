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
 * The right-hand column is a real node REPL transcript rather than a rendering
 * of one: the `Uncaught TypeError` block, its `at JSON.stringify (<anonymous>)`
 * frame, the `undefined` the import echoes, and the array broken over four
 * lines are all what node 24 prints for exactly these bindings. The three
 * results are what the library returns for exactly this graph, in this order.
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
  profile: 'docs-wide',
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 70, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 9_400, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    heading: 'Three back references in one graph. JSON.stringify names one of them.',
    caption: 'One call, every cycle: where each was found, and what it points back to.',
    restMs: 1_500,
    panels: [
      {
        title: 'graph.mjs',
        kind: 'code',
        weight: 0.82,
        rows: [
          { text: "const user = { name: 'alice' }", atMs: 200, typeMs: 620 },
          { text: 'const cart = { owner: user }', atMs: 900, typeMs: 560 },
          { text: 'const line = { cart, buyer: user }', atMs: 1_540, typeMs: 660 },
          { text: '', atMs: 2_260 },
          { text: 'user.cart = cart', atMs: 2_300, typeMs: 340 },
          { text: 'cart.lines = [line]', atMs: 2_700, typeMs: 380 },
          { text: '', atMs: 3_140 },
          { text: 'const state = { user }', atMs: 3_180, typeMs: 440 },
        ],
      },
      {
        title: 'node',
        kind: 'result',
        chrome: true,
        weight: 1.38,
        rows: [
          { text: "> const data = await import('@hyperfrontend/data-utils')", atMs: 3_900, typeMs: 1_000 },
          { text: 'undefined', atMs: 5_050, tone: 'muted' },
          { text: '> JSON.stringify(state)', atMs: 5_250, typeMs: 460 },
          { text: 'Uncaught TypeError: Converting circular structure to JSON', atMs: 5_950, tone: 'danger' },
          { text: "    --> starting at object with constructor 'Object'", atMs: 6_060, tone: 'muted' },
          { text: "    |     property 'cart' -> object with constructor 'Object'", atMs: 6_150, tone: 'muted' },
          { text: "    --- property 'owner' closes the circle", atMs: 6_240, tone: 'warning' },
          { text: '    at JSON.stringify (<anonymous>)', atMs: 6_330, tone: 'muted' },
          { text: "> data.locateCircularReference(state, '*').map(String)", atMs: 6_800, typeMs: 1_150 },
          { text: '[', atMs: 8_200, tone: 'muted' },
          { text: "  'user·cart·owner → user',", atMs: 8_330, tone: 'accent', emphasis: true },
          { text: "  'user·cart·lines·0·cart → user·cart',", atMs: 8_520, tone: 'accent', emphasis: true },
          { text: "  'user·cart·lines·0·buyer → user'", atMs: 8_710, tone: 'accent', emphasis: true },
          { text: ']', atMs: 8_880, tone: 'muted' },
        ],
      },
    ],
  },
})
