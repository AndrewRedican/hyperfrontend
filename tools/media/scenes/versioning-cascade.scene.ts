import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * One header line, and everything that falls out of it.
 *
 * The claim a release library has to make is that nobody chooses the version:
 * the commit message already contains the decision, and the `!` in
 * `feat(api)!` is the whole argument for a major. So the frame is that one line
 * typing itself out and the four things derived from it, in the order the
 * library derives them: the commit it parses to, the bump the type and the
 * breaking flag imply, the version `increment` produces from the one on disk,
 * and the line the serializer writes into CHANGELOG.md.
 *
 * The scope reads `[ 'api' ]` rather than `'api'` because
 * `ConventionalCommit.scope` is a `readonly string[]`; a header may name
 * several, and `feat(a,b): x` parses to two. The package's own quick start
 * prints it as a bare string, which the parser disagrees with, and the written
 * line is where the array pays off: the bold label on it is the scope array
 * joined with a comma.
 *
 * The version being incremented sits past 1.0.0 on purpose. `getSemverBump`
 * answers `major` for any breaking commit, but the release flow carries a rule
 * of its own for a package still under 1.0.0, where the same commit takes the
 * minor instead. Starting at 2.4.1 keeps the two in agreement, and the caption
 * says what the other case does.
 *
 * Verified against `libs/versioning/src/commits/parse/header.ts` (the `!`
 * before the colon sets `breaking`, and the parenthesised scope is split on
 * commas into an array), `libs/versioning/src/commits/parse/message.ts`
 * (`breakingDescription` falls back to the subject when the marker is in the
 * header and no footer overrides it), `commits/models/conventional.ts` (the
 * field order and the readonly array), `commits/models/commit-type.ts`
 * (`getSemverBump` returns `major` for any breaking commit),
 * `semver/increment/bump.ts` (a major zeroes minor and patch),
 * `semver/parse/version.ts` and `semver/format/to-string.ts` (strict parsing
 * returns a `SemVer`, and `format` writes it back),
 * `changelog/serialize/to-string.ts` with `changelog/serialize/templates.ts`
 * (the `- ` marker, the `**BREAKING** ` prefix, the `**scope:** ` label, and
 * the plain `## version - date` heading an entry carrying no compare URL gets,
 * each heading followed by a blank line),
 * `flow/steps/generate-changelog.ts` (the breaking section is headed `Breaking
 * Changes` and its scope label is the joined array) and
 * `flow/steps/calculate-bump.ts` (the caption's rule). The parse of
 * `feat(api)!: ...` into `['api']` is asserted in
 * `libs/versioning/src/commits/parse/header.spec.ts` and `message.spec.ts`.
 */
export default defineScriptedScene({
  slug: 'versioning-cascade',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'docs-wide',
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 75, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 9_700, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    heading: 'One commit header decides the bump, the version it produces and the entry it writes.',
    caption: 'The release flow adds a rule getSemverBump does not: below 1.0.0, a breaking change takes the minor.',
    restMs: 1_400,
    panels: [
      {
        title: '@hyperfrontend/versioning',
        kind: 'code',
        weight: 1.05,
        rows: [
          { text: "const header = 'feat(api)!: remove v1 endpoint'", atMs: 200, typeMs: 1_050 },
          { text: '', atMs: 1_320 },
          { text: 'const commit = parseConventionalCommit(header)', atMs: 1_420, typeMs: 720 },
          { text: 'const { type, scope, subject, breaking } = commit', atMs: 3_050, typeMs: 660 },
          { text: '', atMs: 3_760 },
          { text: 'const bump = getSemverBump(type, breaking)', atMs: 3_900, typeMs: 580 },
          { text: "const from = parseVersionStrict('2.4.1')", atMs: 5_000, typeMs: 540 },
          { text: 'const next = format(increment(from, bump))', atMs: 5_650, typeMs: 580 },
          { text: '', atMs: 6_550 },
          { text: 'const item = createChangelogItem(subject, {', atMs: 6_700, typeMs: 540 },
          { text: "  scope: scope.join(', '),", atMs: 7_300, typeMs: 320 },
          { text: '  breaking: true,', atMs: 7_680, typeMs: 220 },
          { text: '})', atMs: 7_950, typeMs: 110 },
        ],
      },
      {
        title: 'what it produces',
        kind: 'result',
        weight: 0.95,
        rows: [
          { text: "{ type: 'feat', scope: [ 'api' ],", atMs: 2_330 },
          { text: "  subject: 'remove v1 endpoint',", atMs: 2_460 },
          { text: '  footers: [], breaking: true,', atMs: 2_590 },
          { text: "  breakingDescription: 'remove v1 endpoint',", atMs: 2_720 },
          { text: '  raw: header }', atMs: 2_850 },
          { text: '', atMs: 4_550 },
          { text: "bump: 'major'", atMs: 4_680, untilMs: 6_400, marker: '›', tone: 'accent' },
          { text: "bump: 'major'   next: '3.0.0'", atMs: 6_400, marker: '›', tone: 'accent', emphasis: true },
          { text: '', atMs: 8_200 },
          { text: 'CHANGELOG.md', atMs: 8_300, tone: 'muted' },
          { text: '## 3.0.0 - 2026-09-10', atMs: 8_500 },
          { text: '', atMs: 8_640 },
          { text: '### Breaking Changes', atMs: 8_780 },
          { text: '', atMs: 8_920 },
          { text: '- **BREAKING** **api:** remove v1 endpoint', atMs: 9_060, tone: 'success', emphasis: true },
        ],
      },
    ],
  },
})
