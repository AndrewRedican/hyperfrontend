import { hairpinStage } from '../src/hairpin/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('server')

/** When the stop signal reaches the process. */
const STOP_AT_MS = 6_250

/**
 * A request goes in through the steps and a value comes back out through
 * them; told to stop, the process finishes what it holds and then ends.
 *
 * The package makes two claims, and the frame draws both in one picture. The
 * first is that a service is a list of steps that return a response value:
 * so the steps stand as panes inside the process, two lanes cross every one
 * of them, and a turn inside each pane joins the lane in to the lane out. A
 * request comes in hollow, comes round the turn of the step that answers it,
 * and sets off back solid. One goes all the way to `router`, and on its way
 * back `cors` closes a band round it: a step that called the next one is
 * free to mark what came back. One is answered by `health`, the first step,
 * and never reaches the others. The second claim is that the same package
 * runs the service as a process a supervisor can read: so the process is a
 * shell with a way in and a way out, the runner's chip sits on its edge, and
 * a wire hangs from the chip to a slot. A stop signal climbs the wire; the
 * way in swings shut and a request that arrives after that is turned away;
 * the two requests already inside come round and leave; only then do the
 * panes go dark, and the exit code comes down the wire into the slot. The
 * loop ends on the frame it starts from, a process that has ended and is
 * about to be started again.
 *
 * Verified on 2026-11-22 against `libs/server/src/service/contract.ts` (a
 * step takes the request, a context and `next`, and returns a response or a
 * promise of one), `libs/server/src/service/health.ts` (`health` answers its
 * own path and passes every other request on),
 * `libs/server/src/service/cors.ts` (a request that is no preflight runs on
 * through `next()` and the response that comes back is marked),
 * `libs/server/src/service/router.ts` (`router` is the step that ends the
 * list here), the drain as the architecture guide states it (closing stops
 * the server accepting, new connections are refused, exchanges in flight run
 * on) and `libs/server/src/service/run.ts` (`runService` listens for
 * `SIGTERM`, closes the started service and ends the process with code 0
 * when it stopped because it was asked to and nothing failed). The five
 * requests and their timing are the scene's own.
 */
export default defineScriptedScene({
  slug: 'server-hairpin',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: hairpinStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 50, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: STOP_AT_MS + 1_050, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    runner: 'runService',
    steps: [{ name: 'health' }, { name: 'cors', decorates: true }, { name: 'router', workMs: 300 }],
    requests: [
      { atMs: 450, answeredBy: 2 },
      { atMs: 1_700, answeredBy: 0 },
      { atMs: 4_300, answeredBy: 2 },
      { atMs: 5_050, answeredBy: 2 },
      { atMs: STOP_AT_MS, answeredBy: 2 },
    ],
    signal: 'SIGTERM',
    stopAtMs: STOP_AT_MS,
    exitCode: 0,
    speed: 300,
    restMs: 900,
  },
})
