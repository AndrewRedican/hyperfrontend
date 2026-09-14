import { graphStage } from '../src/graph/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('data-utils')

/** How long the cursor takes to travel one edge. */
const TRAVEL_MS = 700

/**
 * The moment a step sets off, given when the one before it landed.
 *
 * A cycle costs the cursor a landing pause and a return trip on top of the
 * travel, so the next step waits for that; a forward step only waits for the
 * travel and a short breath.
 *
 * @param previousAtMs - When the previous step set off.
 * @param previousWasCycle - Whether the previous step closed a cycle.
 * @returns When this step sets off.
 */
function after(previousAtMs: number, previousWasCycle: boolean): number {
  return previousAtMs + TRAVEL_MS + (previousWasCycle ? 250 + 500 + 250 : 200)
}

const step0 = 600
const step1 = after(step0, false)
const step2 = after(step1, false)
const step3 = after(step2, true)
const step4 = after(step3, false)
const step5 = after(step4, true)

/**
 * A graph with three back references, and the walk that finds all of them.
 *
 * `JSON.stringify` meets the first cycle and throws; `locateCircularReference`
 * with `'*'` walks the whole graph and returns every place a reference points
 * back at an ancestor. So the frame is the graph itself, drawn as objects in a
 * row with the forward references between them and the three back references
 * as arcs, and a cursor that walks it depth first. Each time the cursor
 * follows an arc onto a node it has already filled, the arc lights, a number
 * lands on it, and the count beside the call ticks up. The three lit arcs at
 * the end are what the call returns.
 *
 * The bindings are the package readme's own: `user` owns a `cart`, the cart
 * holds `lines` whose first line points back at the cart and at the buyer.
 * The order the arcs light in is the order the library reports them,
 * verified against `libs/utils/data/src/locate-circular-reference.ts` and its
 * spec on 2026-09-12: `user·cart·owner → user`, `user·cart·lines·0·cart →
 * user·cart`, `user·cart·lines·0·buyer → user`.
 */
export default defineScriptedScene({
  slug: 'data-utils-circular',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: graphStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 60, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 8_600, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    api: { name: 'locateCircularReference', mark: identity.mark },
    start: 'state',
    travelMs: TRAVEL_MS,
    restMs: 1_300,
    nodes: [
      { id: 'state', label: 'state', x: 96, y: 200 },
      { id: 'user', label: 'user', x: 246, y: 200 },
      { id: 'cart', label: 'cart', x: 396, y: 200 },
      { id: 'line', label: 'line', x: 546, y: 200 },
    ],
    edges: [
      { from: 'state', to: 'user', label: 'user' },
      { from: 'user', to: 'cart', label: 'cart' },
      { from: 'cart', to: 'user', label: 'owner', bow: -58 },
      { from: 'cart', to: 'line', label: 'lines·0' },
      { from: 'line', to: 'cart', label: 'cart', bow: -58 },
      { from: 'line', to: 'user', label: 'buyer', bow: 96 },
    ],
    steps: [
      { edge: 0, atMs: step0 },
      { edge: 1, atMs: step1 },
      { edge: 2, atMs: step2, cycle: true },
      { edge: 3, atMs: step3 },
      { edge: 4, atMs: step4, cycle: true },
      { edge: 5, atMs: step5, cycle: true },
    ],
  },
})
