import { reachStage } from '../src/reach/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('workspace')

/** How long the change takes to travel one edge. */
const TRAVEL_MS = 850

/** When the file changes. */
const CHANGE_AT_MS = 700

/** When the change sets off from the changed project. */
const FIRST_LEG_MS = CHANGE_AT_MS + 600

/** When the first legs have arrived or faded. */
const FIRST_ARRIVAL_MS = FIRST_LEG_MS + TRAVEL_MS

/** When it sets off again from the first project it reached. */
const SECOND_LEG_MS = FIRST_ARRIVAL_MS + 1_500

/** When the second leg has arrived. */
const SECOND_ARRIVAL_MS = SECOND_LEG_MS + TRAVEL_MS

/**
 * A change in one project, and the tasks it reaches.
 *
 * The claim the package makes is that a change selects exactly the tasks it
 * reaches, and that the selection can say why: the graph knows each import's
 * kind and the role of the file that made it. So the frame is the graph
 * itself: five projects as tiles, each with its test task, and the imports
 * between them as edges. A file in `core` changes and the change sets off
 * along every import of `core`. It arrives at `api`, whose import is a plain
 * value import, and at `cli`, which imports `core` from a spec alone: a test
 * task runs the specs, so that import counts. It fades on the way to `types`,
 * which imports `core` for its types alone, stripped before a test runs. Then
 * it carries on from `api` to `web`. Three lit tasks are what the affected run
 * executes, and one line of caption names the rule each moment shows.
 *
 * Verified on 2026-11-07 against `libs/workspace/src/graph/affected/targets.ts`
 * (`TYPE_BLIND_TARGETS` holds `test` and `lint`, whose closure skips type-only
 * imports; every target but `build` reaches its dependencies from every own
 * file it reads, specs included) and `affected/select.ts` (a task is selected
 * by a changed file of another project its closure reaches, and the closure
 * follows the edges of the kinds and roles the target cares about from one
 * project into the next).
 */
export default defineScriptedScene({
  slug: 'workspace-reach',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: reachStage,
  holdMs: 2_200,
  gif: { colours: 56, lossy: 50, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: SECOND_ARRIVAL_MS + 900, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    api: { name: 'selectAffected', mark: identity.mark },
    command: 'hf affected -t test',
    task: 'test',
    changed: 'core',
    changeAtMs: CHANGE_AT_MS,
    travelMs: TRAVEL_MS,
    restMs: 2_400,
    nodes: [
      { id: 'types', label: 'types', x: 112, y: 112 },
      { id: 'core', label: 'core', x: 112, y: 258 },
      { id: 'api', label: 'api', x: 320, y: 250 },
      { id: 'cli', label: 'cli', x: 528, y: 112 },
      { id: 'web', label: 'web', x: 528, y: 258 },
    ],
    edges: [
      { from: 'core', to: 'api' },
      { from: 'core', to: 'types', typeOnly: true },
      { from: 'core', to: 'cli', fromSpec: true },
      { from: 'api', to: 'web' },
      { from: 'types', to: 'cli' },
    ],
    steps: [
      { edge: 0, atMs: FIRST_LEG_MS },
      { edge: 1, atMs: FIRST_LEG_MS },
      { edge: 2, atMs: FIRST_LEG_MS },
      { edge: 3, atMs: SECOND_LEG_MS },
    ],
    captions: [
      { atMs: CHANGE_AT_MS, text: 'a file in core changes' },
      { atMs: FIRST_LEG_MS, text: 'the change follows every import of core, by kind and by the file that made it' },
      { atMs: FIRST_LEG_MS + 420, text: 'types imports core for types alone: stripped before a test runs, so nothing arrives' },
      { atMs: FIRST_ARRIVAL_MS + 150, text: 'api imports a value, and cli imports core from a spec: a test runs specs, so both are reached' },
      { atMs: SECOND_LEG_MS, text: 'from api the change carries on to web' },
      { atMs: SECOND_ARRIVAL_MS + 300, text: '3 of 5 test tasks run, each with the rule and the file that selected it' },
    ],
  },
})
