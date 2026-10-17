import type { EcosystemChip, EcosystemConfig } from '../src/models/ecosystem'
import { ecosystemHeight } from '../src/ecosystem/layout'
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
 * The published packages, grouped as the documentation site's library index
 * groups them, which is by how close each one is to the problem a visitor
 * arrived with.
 *
 * The flagship at the top, the two messaging packages it runs on under it;
 * the libraries that stand on their own to the left and the build, release
 * and testing tooling to the right, listed in two columns so the two flanks
 * stand at one height; the three primitives the runtime is built from across
 * the middle, understated by their names; and the single-purpose utilities
 * along the foot. The arrows are the only relations worth drawing on a
 * landing page: the runtime chain from the flagship down to the cryptography,
 * and the builder that packs a feature into the shell a host installs.
 */
const config: EcosystemConfig = {
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
    caption: 'Build, release and test',
    columns: 2,
    chips: [chip('builder', 'packs the shell'), chip('versioning'), chip('project-scope'), chip('questions'), chip('testing')],
  },
  middle: {
    caption: 'Primitives the runtime is built from',
    chips: [chip('json-utils'), chip('ui-utils'), chip('immutable-api-utils')],
  },
  foot: {
    caption: 'Utilities',
    chips: [
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
}

/**
 * The repository readme's map of the published packages.
 *
 * The heading above the figure says what it is, so it carries no caption of
 * its own, and the frame is exactly as tall as the map needs. Recorded in
 * the portable theme only, for the readme on GitHub.
 */
export default defineScriptedScene({
  slug: 'readme-ecosystem',
  asset: 'figure',
  outputs: ['still'],
  profile: readmeProfile(ecosystemHeight(config, readmeProfile(0))),
  themes: ['portable'],
  hue: identity.hue,
  stage: ecosystemStage,
  stills: [{ name: 'figure', atMs: 0, format: 'png', quality: 90, maxBytes: 220_000 }],
  config,
})
