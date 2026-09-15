import { agreementStage } from '../src/agreement/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { articleProfile } from './lib/article'
import { workspaceIdentity } from './lib/identity'

/** The workspace's hue and mark. */
const identity = workspaceIdentity()

/**
 * The closing thesis of "The Long Way Around", drawn as the last slide of a
 * talk: two ways to divide a system, and where each makes agreement
 * mandatory.
 *
 * Cohesion first stands its applications on one shared slab and ties every
 * pair to every other; isolation first walls them apart and joins them by
 * one deliberate wire. Hyperfrontend sits on the axis at the isolation end,
 * on purpose.
 */
export default defineScriptedScene({
  slug: 'long-way-agreement',
  asset: 'figure',
  outputs: ['still'],
  profile: articleProfile(456),
  hue: identity.hue,
  stage: agreementStage,
  stills: [{ name: 'figure', atMs: 0, format: 'webp', quality: 84, maxBytes: 140_000 }],
  config: {
    applications: 4,
    cohesion: {
      caption: 'Cohesion first',
      note: 'agree before runtime, then carve out independence',
      ground: 'shared framework, dependencies, build, release cadence',
      traits: [
        { label: 'shared assumptions', value: 'many' },
        { label: 'runtime integration', value: 'cheaper' },
        { label: 'coordination required', value: 'higher' },
      ],
    },
    isolation: {
      caption: 'Isolation first',
      note: 'hard boundaries first, then earn cohesion back',
      ground: 'own runtime, own dependencies, own release',
      traits: [
        { label: 'shared assumptions', value: 'few' },
        { label: 'runtime boundary', value: 'harder' },
        { label: 'coordination required', value: 'lower' },
      ],
    },
    axisLeft: 'agreement required before anything runs',
    axisRight: 'agreement required only at the contract',
    marker: 'Hyperfrontend',
    mark: identity.mark,
    caption: 'Architecture decides where agreement is mandatory.',
  },
})
