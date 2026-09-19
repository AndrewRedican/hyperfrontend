import type { EcosystemChip } from '../src/models/ecosystem'
import { ecosystemStage } from '../src/ecosystem/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity, workspaceIdentity } from './lib/identity'
import { readmeProfile } from './lib/readme'

/** The workspace's hue. */
const identity = workspaceIdentity()

/**
 * A package as a chip, with a note under it when its relation to the flagship is worth a word.
 *
 * @param name - The package's registry name without its scope.
 * @param note - What it does for the flagship, or nothing.
 * @returns The chip with the package's mark looked up.
 */
function chip(name: string, note?: string): EcosystemChip {
  return note === undefined ? { name, mark: packageIdentity(name).mark } : { name, mark: packageIdentity(name).mark, note }
}

/**
 * The repository readme's map of the published packages.
 *
 * The same grouping the documentation site's library index uses: the
 * flagship at the top, the two messaging packages it runs on under it, the
 * libraries that stand on their own to the left, the build and release
 * tooling to the right, and the single-purpose utilities along the foot.
 * The arrows are the only relations worth drawing on a landing page: the
 * runtime chain from the flagship down to the cryptography, and the builder
 * that packs a feature into the shell a host installs. The heading above
 * the figure says what it is, so it carries no caption of its own.
 *
 * Recorded in the portable theme only, for the readme on GitHub.
 */
export default defineScriptedScene({
  slug: 'readme-ecosystem',
  asset: 'figure',
  outputs: ['still'],
  profile: readmeProfile(540),
  themes: ['portable'],
  hue: identity.hue,
  stage: ecosystemStage,
  stills: [{ name: 'figure', atMs: 0, format: 'png', quality: 90, maxBytes: 220_000 }],
  config: {
    caption: '',
    note: '',
    stamp: '',
    hub: chip('features'),
    spine: [chip('nexus'), chip('network-protocol')],
    spineCaption: 'Cross-window messaging',
    left: {
      caption: 'Stand on their own',
      chips: [chip('cryptography', 'seals the channel'), chip('state-machine'), chip('logging')],
    },
    right: {
      caption: 'Build and release',
      chips: [chip('builder', 'packs the shell'), chip('versioning'), chip('project-scope'), chip('questions')],
    },
    foot: {
      caption: 'Utilities',
      chips: [
        chip('json-utils'),
        chip('ui-utils'),
        chip('immutable-api-utils'),
        chip('data-utils'),
        chip('time-utils'),
        chip('random-generator-utils'),
        chip('string-utils'),
        chip('list-utils'),
        chip('function-utils'),
      ],
    },
    edges: [
      { from: 'features', to: 'nexus' },
      { from: 'nexus', to: 'network-protocol' },
      { from: 'network-protocol', to: 'cryptography' },
      { from: 'features', to: 'builder' },
    ],
  },
})
