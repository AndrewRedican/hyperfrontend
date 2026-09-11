import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * A folder layout on the left, and the manifest that ships on the right.
 *
 * The builder's least visible service is that nobody in a library maintains
 * `main`, `module`, `types`, the conditional `exports` map or the `files`
 * allowlist. So the frame is that division of labour: the tree types itself in,
 * the way a person writes one, and the two panes beside it simply appear,
 * because a build wrote them and a build rewrites them every time.
 *
 * Every value on the right is what the builder actually emits. `./package.json`
 * is always the first key of the map; a subpath is published only for the
 * formats that really landed, which is what makes each entry a `types` /
 * `import` / `require` triple; the root pointers are written only when a root
 * entry was bundled, and deleted outright when it was not, so a consumer can
 * never resolve a default that does not exist. The allowlist is walked out of
 * the finished output directory rather than predicted from config, which is why
 * two `index` globs stand in for every entrypoint at any depth, why the
 * metadata files are named one at a time, and why the sourcemap negation has to
 * be the last pattern of all: npm resolves `files` last match wins, so sorting
 * it in with the rest would put it ahead of the glob it exists to subtract.
 *
 * The two panes are one file, and the gap between them is real: a dozen fields
 * carried over from the source manifest sit between the closing brace of
 * `exports` and `main`, and `files` is appended last of all by a second pass
 * that runs after the bin, license and asset phases have finished emitting. The
 * three pointers and the allowlist are neighbours only because this library
 * ships neither a CDN bundle nor a bin; either one would put its own fields
 * between them.
 *
 * The example library is the scene's own, because the package has no opinion
 * about how source is arranged. What is not the scene's own is the subpath
 * itself: the source `package.json` declares it against `./src/...`, and the
 * builder mirrors that declaration onto whatever the bundle phase produced.
 *
 * Verified against `libs/builder/src/package/json/generate-exports.ts` (the
 * self-reference first, the conditional triple, source-exports-first),
 * `libs/builder/src/package/json/synthesize.ts` (the `main` / `module` /
 * `types` rules and the order the fields are assigned in),
 * `libs/builder/src/package/json/reflect-files-allowlist.ts` (the two globs,
 * the named survivors, the trailing negation and why it is appended after the
 * sort), `libs/builder/src/package/finalize-files.ts` (the allowlist is written
 * last, from the materialized tree), `libs/builder/src/package/run-package-phase.ts`
 * (the phase itself never passes `files`), `libs/builder/src/bundle/entries/discover-entries.ts`
 * (a directory becomes an entry point by holding an `index.ts`) and the specs
 * beside them for the exact emitted strings.
 */
export default defineScriptedScene({
  slug: 'builder-manifest',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'docs-wide',
  stage: panelStage,
  holdMs: 1_500,
  gif: { colours: 56, lossy: 78, maxBytes: 1_000_000 },
  stills: [{ name: 'poster', atMs: 7_700, format: 'webp', quality: 82, maxBytes: 90_000 }],
  config: {
    theme: 'midnight',
    heading: 'You maintain the tree. The build maintains the manifest.',
    caption: 'Every path on the right is reflected from what actually landed in dist, on every build.',
    restMs: 1_600,
    panels: [
      {
        title: 'hand written',
        kind: 'code',
        align: 'center',
        weight: 0.68,
        rows: [
          { text: 'libs/toolkit/', atMs: 200, typeMs: 320 },
          { text: '  package.json', atMs: 620, typeMs: 300 },
          { text: '  src/', atMs: 1_000, typeMs: 180 },
          { text: '    index.ts', atMs: 1_240, typeMs: 240 },
          { text: '    models/', atMs: 1_540, typeMs: 230 },
          { text: '      index.ts', atMs: 1_830, typeMs: 240 },
          { text: '      order.ts', atMs: 2_130, typeMs: 240 },
          { text: '      user.ts', atMs: 2_430, typeMs: 230 },
        ],
      },
      {
        title: 'dist/libs/toolkit/package.json',
        kind: 'code',
        weight: 1.34,
        rows: [
          { text: '"exports": {', atMs: 3_000 },
          { text: '  "./package.json": "./package.json",', atMs: 3_180 },
          { text: '  ".": {', atMs: 3_360 },
          { text: '    "types": "./index.d.ts",', atMs: 3_500 },
          { text: '    "import": "./index.esm.js",', atMs: 3_640 },
          { text: '    "require": "./index.cjs.js"', atMs: 3_780 },
          { text: '  },', atMs: 3_920 },
          { text: '  "./models": {', atMs: 4_120 },
          { text: '    "types": "./models/index.d.ts",', atMs: 4_260 },
          { text: '    "import": "./models/index.esm.js",', atMs: 4_400 },
          { text: '    "require": "./models/index.cjs.js"', atMs: 4_540 },
          { text: '  }', atMs: 4_680 },
          { text: '}', atMs: 4_820 },
        ],
      },
      {
        title: 'further down that file',
        kind: 'code',
        weight: 0.98,
        rows: [
          { text: '"main": "./index.cjs.js",', atMs: 5_300 },
          { text: '"module": "./index.esm.js",', atMs: 5_460 },
          { text: '"types": "./index.d.ts",', atMs: 5_620 },
          { text: '"files": [', atMs: 5_900 },
          { text: '  "**/index.*",', atMs: 6_060 },
          { text: '  "**/index.d.ts",', atMs: 6_200 },
          { text: '  "CHANGELOG.md",', atMs: 6_340 },
          { text: '  "LICENSE.md",', atMs: 6_480 },
          { text: '  "README.md",', atMs: 6_620 },
          { text: '  "SECURITY.md",', atMs: 6_760 },
          { text: '  "!**/*.js.map"', atMs: 7_060, emphasis: true },
          { text: ']', atMs: 7_240 },
        ],
      },
    ],
  },
})
