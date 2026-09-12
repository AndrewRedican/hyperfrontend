import { lifecycleStage } from '../src/lifecycle/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/** How long one mount and unmount cycle takes on screen. */
const CYCLE_MS = 1_100

/** How many times the widget is mounted. */
const CYCLES = 6

/**
 * Six mounts of the same widget, on two pages.
 *
 * The organising rule of this package is one sentence long: anything that
 * attaches something hands back the function that detaches it. Said, it sounds
 * like housekeeping. Watched, it is the difference between a widget you can
 * mount six times and a page whose head fills with abandoned `<style>`
 * elements while the observers and listeners of every earlier mount are left
 * on the page as ghosts, watching an element that is gone.
 *
 * Only the left-hand page accumulates, and nothing on it ever goes away,
 * because nothing in the naive version was ever given the means to. That is
 * the shape of every leak this package exists to make impossible: monotone.
 *
 * Verified against `libs/utils/ui/src/lib/stylesheets.ts`, where
 * `addStylesheet(css, label?)` returns `[HTMLStyleElement, () => void]`, and
 * `libs/utils/ui/src/element/index.ts`, which exports `onElementResize`,
 * `getElementAsync` and `syncElementDimensions` beside it. The counts are what
 * six mount and unmount cycles of an embed using those four would leave behind.
 */
export default defineScriptedScene({
  slug: 'ui-utils-teardown',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 322,
  stage: lifecycleStage,
  holdMs: 1_800,
  gif: { colours: 48, lossy: 40, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 7_900, format: 'webp', quality: 82, maxBytes: 60_000 }],
  config: {
    heading: 'Mount the same widget six times. Unmount it six times.',
    caption: 'const [element, remove] = addStylesheet(css). The second half is the point.',
    cycles: CYCLES,
    cycleMs: CYCLE_MS,
    startMs: 500,
    listenersPerMount: 4,
    restMs: 1_500,
    panels: [
      { title: 'The obvious way', teardown: false, note: 'appended on mount, never removed; observers watching an element that is gone' },
      { title: 'With the returned teardown', teardown: true, note: 'remove() on unmount; onElementResize hands back its disconnect' },
    ],
  },
})
