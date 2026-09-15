import type { EcosystemChip } from '../src/models/ecosystem'
import { ecosystemStage } from '../src/ecosystem/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { articleProfile } from './lib/article'
import { packageIdentity, workspaceIdentity } from './lib/identity'

/** The workspace's hue. */
const identity = workspaceIdentity()

/**
 * A package as a chip, with the need that produced it when the article names one.
 *
 * @param name - The package's registry name without its scope.
 * @param note - The need that produced the package, or nothing when the article does not single it out.
 * @returns The chip with the package's mark looked up.
 */
function chip(name: string, note?: string): EcosystemChip {
  return note === undefined ? { name, mark: packageIdentity(name).mark } : { name, mark: packageIdentity(name).mark, note }
}

/**
 * The nineteen published packages, grouped by the kind of need each answered.
 *
 * The flagship sits at the top; the two communication packages hang under
 * it; the primitives and the tooling flank them; the nine utilities are the
 * layer along the foot. The arrows are the article's own sentences: secure
 * communication exposed cryptography, communication exposed protocols and
 * Nexus, scaffolding exposed Project Scope, distribution exposed packaging,
 * release management exposed versioning. Every other edge of the dependency
 * graph is left out on purpose.
 */
export default defineScriptedScene({
  slug: 'long-way-ecosystem',
  asset: 'figure',
  outputs: ['still'],
  profile: articleProfile(590),
  hue: identity.hue,
  stage: ecosystemStage,
  stills: [{ name: 'figure', atMs: 0, format: 'webp', quality: 84, maxBytes: 180_000 }],
  config: {
    caption: 'Nineteen published packages',
    note: 'each one a local problem turned into a reusable boundary',
    stamp: 'September 2026',
    hub: chip('features'),
    spine: [chip('nexus'), chip('network-protocol')],
    spineCaption: 'Runtime communication',
    left: {
      caption: 'Primitives',
      chips: [chip('cryptography', 'secure communication'), chip('logging'), chip('state-machine')],
    },
    right: {
      caption: 'Tooling',
      chips: [chip('builder', 'distribution'), chip('project-scope', 'scaffolding'), chip('versioning', 'release management'), chip('questions')],
    },
    foot: {
      caption: 'Utilities',
      chips: [
        chip('data-utils'),
        chip('function-utils'),
        chip('immutable-api-utils'),
        chip('json-utils'),
        chip('list-utils'),
        chip('random-generator-utils'),
        chip('string-utils'),
        chip('time-utils'),
        chip('ui-utils'),
      ],
    },
    edges: [
      { from: 'features', to: 'nexus' },
      { from: 'nexus', to: 'network-protocol' },
      { from: 'network-protocol', to: 'cryptography' },
      { from: 'features', to: 'builder' },
      { from: 'features', to: 'project-scope' },
      { from: 'features', to: 'versioning' },
    ],
  },
})
