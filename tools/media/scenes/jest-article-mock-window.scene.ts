import { defineScriptedScene } from '../src/scene/define-scene'
import { windowStage } from '../src/window/stage'
import { articleProfile } from './lib/article'
import { workspaceIdentity } from './lib/identity'

/** The workspace's hue. */
const identity = workspaceIdentity()

/**
 * Why `jest.mock` can keep working under native ESM, from "I Replaced Jest
 * With 1,200 Lines of Code".
 *
 * Static imports are bound before a module's body runs, so a `jest.mock`
 * call in that body executes too late to replace one. The loader never
 * waits for the call: Node hands the load hook the spec's source before it
 * resolves the spec's imports, so the hook reads the call out of the text,
 * the resolve step swaps the import for the mock, and link binds the mock.
 * The figure puts the same call at both ends of the track: read early, run
 * late.
 */
export default defineScriptedScene({
  slug: 'jest-article-mock-window',
  asset: 'figure',
  outputs: ['still'],
  profile: articleProfile(244),
  hue: identity.hue,
  stage: windowStage,
  stills: [{ name: 'figure', atMs: 0, format: 'webp', quality: 84, maxBytes: 120_000 }],
  config: {
    stations: ['load', 'resolve', 'link', 'evaluate'],
    read: { code: "jest.mock('./api')", lead: 'read' },
    substitute: { code: './api → mock' },
    run: { code: "jest.mock('./api')", lead: 'run' },
  },
})
