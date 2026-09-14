import { queueStage } from '../src/queue/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('list-utils')

/**
 * The same three objects into two lists, and two opposite answers.
 *
 * A FIFO list is drawn as a tube open at both ends and a LIFO list as a cup
 * open only at the top. Three numbered discs drop into each at the same
 * moments and stack the same way, which is the pause in the middle: both
 * lists hold the same three things. Then both are pulled three times at the
 * same moments. The tube lets its lowest disc out through the gate at the
 * bottom and the rest settle down; the cup has its top disc lifted out over
 * the rim. The exit rows fill in the order pulled and read `1 2 3` under the
 * tube and `3 2 1` beside the cup.
 *
 * Verified on 2026-09-12 against `libs/utils/list/src/create-fifo-list.ts`,
 * whose `pull()` reads the first value of the backing set, and
 * `libs/utils/list/src/create-lifo-list.ts`, whose `pull()` pops the last;
 * both factories are exported from `libs/utils/list/src/index.ts`.
 */
export default defineScriptedScene({
  slug: 'list-utils-order',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: queueStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 10, maxBytes: 800_000 },
  stills: [{ name: 'poster', atMs: 7_700, format: 'webp', quality: 82, maxBytes: 80_000 }],
  config: {
    fifo: { name: 'createFifoList', mark: identity.mark },
    lifo: { name: 'createLifoList', mark: identity.mark },
    pushAtMs: [600, 1_500, 2_400],
    pullAtMs: [4_000, 5_300, 6_600],
    restMs: 900,
  },
})
