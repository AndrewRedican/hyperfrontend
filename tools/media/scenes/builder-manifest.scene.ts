import { panelStage } from '../src/panel/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { chapter, sequenceStage } from '../src/sequence/stage'

/**
 * One config becoming four formats, and then the manifest nobody wrote.
 *
 * The first chapter is the claim on the tin: `build` takes one declarative
 * config and the output directory fills with an ESM bundle, a CJS bundle, the
 * declarations, and a minified twin of every browser bundle, every entry
 * bundled on its own so a large graph never spikes memory. The second chapter
 * is the builder's least visible service and the one a maintainer feels most:
 * nobody in a library maintains `exports`, `main`, `module`, `types` or the
 * `files` allowlist, because a build writes them and rewrites them every time.
 *
 * Every value on screen is what the builder actually emits. Browser bundles
 * land under `bundle/` with an `index.iife.min.js` and `index.umd.min.js`
 * beside the readable ones, because `minify` defaults on; a subpath is
 * published only for the formats that really landed, which is what makes each
 * entry a `types` / `import` / `require` triple; the root pointers are written
 * only when a root entry was bundled; and the allowlist is walked out of the
 * finished output directory rather than predicted from config, which is why
 * the sourcemap negation is its last pattern: npm resolves `files` last match
 * wins, so sorting it in with the rest would put it ahead of the glob it
 * exists to subtract.
 *
 * The example library is the scene's own, because the package has no opinion
 * about how source is arranged. What is not the scene's own is the subpath
 * itself: the source `package.json` declares it against `./src/...`, and the
 * builder mirrors that declaration onto whatever the bundle phase produced.
 *
 * Verified against `libs/builder/src/models/build-config.ts` (`IifeConfig` and
 * `UmdConfig` take `entry` and `globalName`, and `minify` defaults on),
 * `libs/builder/src/bundle/rollup/worker/job-runner.ts` (the `.min.js` twins
 * and the `bundle/` directory), `libs/builder/src/package/json/generate-exports.ts`
 * (the conditional triple), `libs/builder/src/package/json/synthesize.ts`
 * (the `main` / `module` / `types` rules),
 * `libs/builder/src/package/json/reflect-files-allowlist.ts` (the globs and
 * the trailing negation) and the manifest at `dist/libs/logging/package.json`
 * as built on 2026-09-12, which carries exactly these fields and patterns.
 */
export default defineScriptedScene({
  slug: 'builder-manifest',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 32,
  stage: sequenceStage,
  holdMs: 1_600,
  gif: { colours: 56, lossy: 40, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 11_400, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    segments: [
      chapter(
        'One config, four formats',
        panelStage,
        {
          heading: 'Say which formats. Every entry bundles on its own.',
          caption: 'Per-entry isolation keeps peak memory bounded however large the graph.',
          restMs: 1_100,
          panels: [
            {
              title: 'build.mjs',
              kind: 'code',
              weight: 1.3,
              rows: [
                { text: 'await build({', atMs: 200, typeMs: 320 },
                { text: '  projectRoot, workspaceRoot,', atMs: 560, typeMs: 520 },
                { text: '  esm: {},', atMs: 1_140, typeMs: 240 },
                { text: '  cjs: {},', atMs: 1_440, typeMs: 240 },
                { text: "  iife: { entry: '.', globalName: 'Toolkit' },", atMs: 1_740, typeMs: 820 },
                { text: "  umd:  { entry: '.', globalName: 'Toolkit' },", atMs: 2_620, typeMs: 780 },
                { text: '})', atMs: 3_460, typeMs: 100 },
              ],
            },
            {
              title: 'dist/libs/toolkit',
              kind: 'result',
              weight: 0.7,
              rows: [
                { text: 'index.esm.js', atMs: 3_900, tone: 'accent' },
                { text: 'index.cjs.js', atMs: 4_060, tone: 'accent' },
                { text: 'index.d.ts', atMs: 4_220, tone: 'plain' },
                { text: 'models/index.esm.js', atMs: 4_380, tone: 'accent' },
                { text: 'models/index.cjs.js', atMs: 4_540, tone: 'accent' },
                { text: 'models/index.d.ts', atMs: 4_700, tone: 'plain' },
                { text: 'bundle/index.iife.js', atMs: 4_960, tone: 'success' },
                { text: 'bundle/index.iife.min.js', atMs: 5_120, tone: 'success' },
                { text: 'bundle/index.umd.js', atMs: 5_280, tone: 'success' },
                { text: 'bundle/index.umd.min.js', atMs: 5_440, tone: 'success' },
              ],
            },
          ],
        },
        500
      ),
      chapter(
        'The manifest writes itself',
        panelStage,
        {
          heading: 'You maintain the tree. The build maintains the manifest.',
          caption: 'Every path is reflected from what actually landed in dist, on every build.',
          restMs: 1_100,
          panels: [
            {
              title: 'hand written',
              kind: 'code',
              align: 'center',
              weight: 0.62,
              rows: [
                { text: 'libs/toolkit/', atMs: 200, typeMs: 300 },
                { text: '  package.json', atMs: 560, typeMs: 300 },
                { text: '  src/', atMs: 920, typeMs: 160 },
                { text: '    index.ts', atMs: 1_140, typeMs: 220 },
                { text: '    models/', atMs: 1_420, typeMs: 220 },
                { text: '      index.ts', atMs: 1_700, typeMs: 220 },
              ],
            },
            {
              title: 'dist/libs/toolkit/package.json',
              kind: 'code',
              weight: 1.38,
              rows: [
                { text: '"exports": {', atMs: 2_300 },
                { text: '  "./models": {', atMs: 2_480 },
                { text: '    "types": "./models/index.d.ts",', atMs: 2_640 },
                { text: '    "import": "./models/index.esm.js",', atMs: 2_800 },
                { text: '    "require": "./models/index.cjs.js"', atMs: 2_960 },
                { text: '  }', atMs: 3_120 },
                { text: '},', atMs: 3_260 },
                { text: '"main": "./index.cjs.js",', atMs: 3_700 },
                { text: '"types": "./index.d.ts",', atMs: 3_860 },
                { text: '"files": ["**/index.*", "README.md", "!**/*.js.map"]', atMs: 4_300, emphasis: true },
              ],
            },
          ],
        }
      ),
    ],
  },
})
