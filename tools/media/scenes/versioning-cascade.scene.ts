import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { chapter, sequenceStage } from '../src/sequence/stage'

/**
 * One header line, and everything that falls out of it.
 *
 * The claim a release library has to make is that nobody chooses the version:
 * the commit message already contains the decision, and the `!` in
 * `feat(api)!` is the whole argument for a major. So the frame is that one line
 * typing itself out and the four things derived from it, in the order the
 * library derives them, over two chapters: the commit it parses to and the
 * bump the type and the breaking flag imply; then the version `increment`
 * produces from the one on disk, and the line the serializer writes into
 * CHANGELOG.md.
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
  profile: 'compact',
  hue: 22,
  stage: sequenceStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 40, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 13_600, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    segments: [
      chapter(
        'The header decides the bump',
        panelStage,
        {
          heading: 'One commit header. Nobody picks the version.',
          caption: 'The ! before the colon is the whole argument for a major.',
          restMs: 1_100,
          panels: [
            {
              title: '@hyperfrontend/versioning',
              kind: 'code',
              rows: [
                { text: "const header = 'feat(api)!: drop v1'", atMs: 200, typeMs: 900 },
                { text: '', atMs: 1_160 },
                { text: 'const commit =', atMs: 1_200, typeMs: 260 },
                { text: '  parseConventionalCommit(header)', atMs: 1_500, typeMs: 560 },
                { text: 'const { type, scope, breaking } =', atMs: 3_100, typeMs: 560 },
                { text: '  commit', atMs: 3_700, typeMs: 120 },
                { text: '', atMs: 3_800 },
                { text: 'const bump =', atMs: 3_850, typeMs: 220 },
                { text: '  getSemverBump(type, breaking)', atMs: 4_100, typeMs: 540 },
              ],
            },
            {
              title: 'what it produces',
              kind: 'result',
              rows: [
                { text: "{ type: 'feat', scope: [ 'api' ],", atMs: 2_300 },
                { text: "  subject: 'drop v1',", atMs: 2_430 },
                { text: '  footers: [], breaking: true,', atMs: 2_560 },
                { text: "  breakingDescription: 'drop v1',", atMs: 2_690 },
                { text: '  raw: header }', atMs: 2_820 },
                { text: '', atMs: 4_700 },
                { text: "bump: 'major'", atMs: 4_800, marker: '›', tone: 'accent', emphasis: true },
              ],
            },
          ],
        },
        500
      ),
      chapter(
        'The bump decides the version and the entry',
        panelStage,
        {
          heading: 'From the version on disk to the line in CHANGELOG.md.',
          caption: 'Below 1.0.0 the release flow takes the minor instead: getSemverBump never does.',
          restMs: 1_200,
          panels: [
            {
              title: '@hyperfrontend/versioning',
              kind: 'code',
              rows: [
                { text: 'const from =', atMs: 200, typeMs: 220 },
                { text: "  parseVersionStrict('2.4.1')", atMs: 460, typeMs: 480 },
                { text: 'const next =', atMs: 900, typeMs: 220 },
                { text: '  format(increment(from, bump))', atMs: 1_160, typeMs: 520 },
                { text: '', atMs: 2_300 },
                { text: 'const item = createChangelogItem(', atMs: 2_400, typeMs: 540 },
                { text: '  subject,', atMs: 3_000, typeMs: 180 },
                { text: "  { scope: scope.join(', '),", atMs: 3_240, typeMs: 420 },
                { text: '    breaking: true })', atMs: 3_720, typeMs: 340 },
              ],
            },
            {
              title: 'what it produces',
              kind: 'result',
              rows: [
                { text: "next: '3.0.0'", atMs: 1_900, marker: '›', tone: 'accent', emphasis: true },
                { text: '', atMs: 4_300 },
                { text: 'CHANGELOG.md', atMs: 4_400, tone: 'muted' },
                { text: '## 3.0.0 - 2026-09-10', atMs: 4_600 },
                { text: '', atMs: 4_740 },
                { text: '### Breaking Changes', atMs: 4_880 },
                { text: '', atMs: 5_020 },
                { text: '- **BREAKING** **api:** drop v1', atMs: 5_160, tone: 'success', emphasis: true },
              ],
            },
          ],
        }
      ),
    ],
  },
})
