import type { Mark } from '../src/models/banner'
import { roadmapStage } from '../src/roadmap/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { articleProfile } from './lib/article'
import { packageIdentity, workspaceIdentity } from './lib/identity'

/** The workspace's hue. */
const identity = workspaceIdentity()

/** The mark of the package whose slot the root declared first. */
const features = packageIdentity('features').mark

/** A clock face with its hands at ten past twelve, for the first demo. */
const CLOCK: Mark = [
  { as: 'circle', attrs: { cx: 16, cy: 16, r: 11 } },
  { as: 'path', attrs: { d: 'M16 9v7l5 3' } },
]

/** A heart, for the demo that measures a pulse. */
const HEART: Mark = [
  { as: 'path', attrs: { d: 'M16 26.5S6.5 20.4 6.5 13.6A5.2 5.2 0 0 1 16 10.6a5.2 5.2 0 0 1 9.5 3C25.5 20.4 16 26.5 16 26.5z' } },
]

/** A koi seen from above, for the pond. */
const KOI: Mark = [
  { as: 'path', attrs: { d: 'M9 16c3-5 9-7 15-4l4 4-4 4c-6 3-12 1-15-4z' } },
  { as: 'path', attrs: { d: 'M9 16 4 10.5v11z' } },
  { as: 'circle', attrs: { cx: 21, cy: 15, r: 1.2 }, solid: true },
]

/**
 * The repository's first year on one line: the map above it, the road below.
 *
 * The root commit of January 19 already declared six demo slots, five
 * frontend placeholders, three backend placeholders and a features plugin,
 * drawn here as rows of empty tiles over that day. The spring is a band of
 * libraries and tooling. The SDK itself landed on June 25, and the demos
 * followed from July: each hangs under the line on the day it shipped. The
 * four first commits are stubs beside the start, with the reason for the
 * resets left unstated because the history does not record one.
 */
export default defineScriptedScene({
  slug: 'long-way-map-before-road',
  asset: 'figure',
  outputs: ['still'],
  profile: articleProfile(470),
  hue: identity.hue,
  stage: roadmapStage,
  stills: [{ name: 'figure', atMs: 0, format: 'webp', quality: 84, maxBytes: 140_000 }],
  config: {
    axisStart: '2026-01-01',
    axisEnd: '2026-09-30',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    map: {
      date: '2026-01-19',
      caption: 'The map',
      note: 'January 19: what the repository root already declared',
      groups: [
        { count: 6, label: 'six demo slots' },
        { count: 5, label: 'five frontend-framework placeholders' },
        { count: 3, label: 'three backend placeholders' },
        { count: 1, label: 'a features plugin', mark: features },
      ],
    },
    span: { from: '2026-02-01', to: '2026-06-24', label: 'February to June: infrastructure libraries and tooling' },
    roadCaption: 'The road',
    roadNote: 'what shipped, on the day it did',
    milestones: [
      { date: '2026-06-25', when: 'Jun 25', label: 'features lands', depth: 1, mark: features },
      { date: '2026-07-05', when: 'Jul 5', label: 'Clock ships', depth: 2, mark: CLOCK },
      { date: '2026-08-04', when: 'Aug 4', label: 'Heartbeat', depth: 1, mark: HEART },
      { date: '2026-08-10', when: 'Aug 10', label: 'Koi Pond', depth: 2, mark: KOI },
    ],
    roots: {
      dates: ['2026-01-19', '2026-01-19', '2026-01-24', '2026-02-08'],
      label: 'four "initial commit" roots in the history',
      note: 'reason for the resets not recorded',
    },
  },
})
