import { clocksStage } from '../src/clocks/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { articleProfile } from './lib/article'
import { workspaceIdentity } from './lib/identity'

/** The workspace's hue and mark. */
const identity = workspaceIdentity()

/**
 * The opening figure of "The Long Way Around": three timescales converging
 * on hyperfrontend.
 *
 * The repository is nine months old; the problem it answers is five years
 * old; the engineering behind it is ten. Three spans on one axis, each
 * starting where its story starts and all ending in September 2026, say that
 * in one glance: the longest is a ruler of years, the shortest a comb of
 * months, and both arrive at the same node.
 */
export default defineScriptedScene({
  slug: 'long-way-three-clocks',
  asset: 'figure',
  outputs: ['still'],
  profile: articleProfile(420),
  hue: identity.hue,
  stage: clocksStage,
  stills: [{ name: 'figure', atMs: 0, format: 'webp', quality: 84, maxBytes: 120_000 }],
  config: {
    axisStart: 2015.75,
    axisEnd: 2026.7,
    target: 'Hyperfrontend',
    targetNote: 'September 2026',
    mark: identity.mark,
    rulerYears: [2016, 2018, 2020, 2022, 2024, 2026],
    spans: [
      { duration: 'About ten years', label: 'building, inheriting and watching software', start: 2016, tickYears: 1, align: 'start' },
      { duration: 'About five years', label: 'returning to the runtime-composition problem', start: 2021.4, tickYears: 1, align: 'start' },
      { duration: 'About nine months', label: 'of concentrated implementation in 2026', start: 2026.05, tickYears: 1 / 12, align: 'end' },
    ],
  },
})
