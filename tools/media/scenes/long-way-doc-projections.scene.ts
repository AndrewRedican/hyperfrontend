import { projectionsStage } from '../src/projections/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { articleProfile } from './lib/article'
import { workspaceIdentity } from './lib/identity'

/** The workspace's hue and mark. */
const identity = workspaceIdentity()

/**
 * Documentation as projections of one source, from "The Long Way Around".
 *
 * The repository and what it knows sit at the centre; the reference, the
 * tutorials, the guides, the explanations, the changelogs, the package
 * pages, the text written for models and the generated pictures are the
 * surfaces that knowledge is thrown onto, each lit by its own cone. The
 * caption says what the shape shows: documentation is architecture and
 * distribution, not a phase that comes after.
 */
export default defineScriptedScene({
  slug: 'long-way-doc-projections',
  asset: 'figure',
  outputs: ['still'],
  profile: articleProfile(520),
  hue: identity.hue,
  stage: projectionsStage,
  stills: [{ name: 'figure', atMs: 0, format: 'webp', quality: 84, maxBytes: 160_000 }],
  config: {
    source: 'Repository truth',
    sourceNote: 'product knowledge',
    mark: identity.mark,
    surfaces: [
      { label: 'API reference', glyph: 'reference' },
      { label: 'Tutorials', glyph: 'book' },
      { label: 'How-to guides', glyph: 'checklist' },
      { label: 'Explanations', glyph: 'bulb' },
      { label: 'Changelogs', glyph: 'tag' },
      { label: 'Package pages', glyph: 'cube' },
      { label: 'Text for models', glyph: 'document' },
      { label: 'Diagrams and GIFs', glyph: 'film' },
    ],
    caption: 'Documentation is architecture and distribution, not a separate writing phase.',
  },
})
