import { gaugeStage } from '../src/gauge/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/** How long one mount and unmount cycle takes on screen. */
const CYCLE_MS = 1_100

/** How many times the widget is mounted. */
const CYCLES = 6

/**
 * Six mounts of the same widget, counted two ways.
 *
 * The organising rule of this package is one sentence long: anything that
 * attaches something hands back the function that detaches it. Said, it sounds
 * like housekeeping. Counted, it is the difference between a widget you can
 * mount six times and a page with six abandoned `<style>` elements, six live
 * `ResizeObserver`s and six listeners nobody can reach any more.
 *
 * Only the left-hand count climbs, and it never comes back down, because
 * nothing in the naive version was ever given the means to. That is the shape
 * of every leak this package exists to make impossible: monotone.
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
  stage: gaugeStage,
  holdMs: 1_800,
  gif: { colours: 40, lossy: 80, maxBytes: 700_000 },
  stills: [{ name: 'poster', atMs: 7_400, format: 'webp', quality: 82, maxBytes: 60_000 }],
  config: {
    theme: 'midnight',
    heading: 'Mount the embed six times. Unmount it six times.',
    caption: 'const [element, remove] = addStylesheet(css). The second half is the point.',
    restMs: 1_700,
    groups: [
      {
        title: 'The obvious way',
        tracks: [
          { label: '<style> in head', max: 6, tone: 'danger', stops: climb(), note: 'appended on mount, never removed' },
          { label: 'ResizeObservers', max: 6, tone: 'danger', stops: climb(), note: 'observing an element that is gone' },
          { label: 'listeners', max: 6, tone: 'danger', stops: climb(), note: 'four per gesture listener' },
        ],
      },
      {
        title: 'With the returned teardown',
        tracks: [
          { label: '<style> in head', max: 6, tone: 'success', stops: sawtooth(), note: 'remove() on unmount' },
          { label: 'ResizeObservers', max: 6, tone: 'success', stops: sawtooth(), note: 'onElementResize returns its disconnect' },
          { label: 'listeners', max: 6, tone: 'success', stops: sawtooth(), note: 'one cleanup for all four' },
        ],
      },
    ],
  },
})

/**
 * A count that goes up on every mount and never comes down.
 *
 * @returns One stop per mount, each a whole number higher than the last.
 */
function climb() {
  const stops = [{ atMs: 500, value: 0 }]
  for (let index = 0; index < CYCLES; index += 1) {
    stops.push({ atMs: 700 + index * CYCLE_MS, value: index + 1 })
  }
  return stops
}

/**
 * A count that goes up on every mount and back down on every unmount.
 *
 * The tooth has to be sharp rather than eased: what is being shown is that the
 * teardown is immediate, and a bar that drifts back to zero would suggest
 * something is being collected rather than released.
 *
 * @returns Stops rising to one and falling to zero, once per cycle.
 */
function sawtooth() {
  const stops = [{ atMs: 500, value: 0 }]
  for (let index = 0; index < CYCLES; index += 1) {
    const at = 700 + index * CYCLE_MS
    stops.push({ atMs: at, value: 1 }, { atMs: at + 460, value: 1 }, { atMs: at + 500, value: 0 })
  }
  return stops
}
