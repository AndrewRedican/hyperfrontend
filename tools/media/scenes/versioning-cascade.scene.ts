import { cascadeStage } from '../src/cascade/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('versioning')

/**
 * One header line, and everything that falls out of it.
 *
 * The claim a release library has to make is that nobody chooses the
 * version: the commit message already contains the decision, and the `!` in
 * `feat(api)!` is the whole argument for a major. So the frame is that one
 * line typing itself at the top of a spine, and four derivations falling
 * down it in the order the library makes them, each named by nothing but
 * the export that performs it: the fields the header parses to, the bump
 * the type and the breaking flag converge on, the version the bump takes
 * `2.4.1` to with its digits rolling, and the line the serializer writes
 * into CHANGELOG.md, assembled from the fields as they fall in.
 *
 * The version being incremented sits past 1.0.0 on purpose. `getSemverBump`
 * answers `major` for any breaking commit, but the release flow carries a
 * rule of its own for a package still under 1.0.0, where the same commit
 * takes the minor instead. Starting at 2.4.1 keeps the two in agreement.
 *
 * Verified on 2026-09-12 against `libs/versioning/src/commits/parse/header.ts`
 * (the `!` before the colon sets `breaking`, and the parenthesised scope is
 * split on commas into an array, so `(api)` parses to `['api']` and the tile
 * shows the one scope it holds), `commits/models/commit-type.ts`
 * (`getSemverBump` returns `major` for any breaking commit),
 * `semver/increment/bump.ts` (a major zeroes minor and patch),
 * `changelog/models/entry.ts` (`createChangelogItem` takes the description
 * and a `scope` and `breaking` beside it) and
 * `changelog/serialize/to-string.ts` (the `- ` marker, the `**BREAKING** `
 * prefix, then the `**scope:** ` label, then the description). All four
 * names are exported from `libs/versioning/src/index.ts`.
 */
export default defineScriptedScene({
  slug: 'versioning-cascade',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: cascadeStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 40, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 9_200, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    mark: identity.mark,
    header: [{ text: 'feat' }, { text: '(api)' }, { text: '!', tone: 'warning' }, { text: ': ' }, { text: 'drop v1' }],
    typeAtMs: 300,
    typeCps: 22,
    parse: {
      api: 'parseConventionalCommit',
      atMs: 1_600,
      fields: [
        { label: 'type', value: 'feat', from: 0 },
        { label: 'scope', value: 'api', from: 1 },
        { label: 'breaking', value: 'true', from: 2, tone: 'warning' },
        { label: 'subject', value: 'drop v1', from: 4 },
      ],
    },
    bump: { api: 'getSemverBump', atMs: 4_000, label: 'bump', value: 'major', from: [0, 2] },
    increment: { api: 'increment', atMs: 5_400, from: '2.4.1', to: '3.0.0' },
    changelog: {
      api: 'createChangelogItem',
      atMs: 7_300,
      tokens: [{ text: '-' }, { text: 'BREAKING', wrap: '**', from: 2, tone: 'warning' }, { text: 'api:', wrap: '**', from: 1 }, { text: 'drop v1', from: 3 }],
      file: 'CHANGELOG.md',
    },
    restMs: 1_200,
  },
})
