import { forgeStage } from '../src/forge/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity } from './lib/identity'

/** The package's hue and mark. */
const identity = packageIdentity('builder')

/**
 * A forge with a mirror: entries go in one at a time, files come out per
 * entry, and the manifest is wired to what landed.
 *
 * Two source entries wait on the left. The root entry streams into the
 * builder first and its files pop into the tree on the right: the ESM and CJS
 * bundles, the declarations, and the two minified browser bundles under
 * `bundle/`. Only when every one of them has landed does the second entry
 * leave its card, because the builder holds one entry at a time. Then the
 * `package.json` sheet rises and wires draw from the files to the keys the
 * build wrote from them: every module and declaration file into `exports`,
 * the root CJS bundle into `main`, the root declarations into `types`, and a
 * bracket down the whole tree into `files`. Nothing on the sheet was typed by
 * anyone; it is what is on disk, reflected.
 *
 * Every file name is what the builder emits, verified on 2026-09-12 against
 * `libs/builder/src/bundle/rollup/worker/job-runner.ts` (`index.esm.js`,
 * `index.cjs.js`, and the `.min.js` twins of the IIFE and UMD bundles, which
 * land because `minify` defaults on in `descriptor.ts`),
 * `libs/builder/src/bundle/run-bundle-phase.ts` (the `bundle/` directory and
 * the one-entry-per-worker loop), `libs/builder/src/package/json/generate-exports.ts`
 * (the `types` / `import` / `require` triple per entry that landed),
 * `libs/builder/src/package/json/synthesize.ts` (`main` and `types` only when a
 * root entry landed) and `libs/builder/src/package/json/reflect-files-allowlist.ts`
 * (`files` walked out of the finished output tree).
 */
export default defineScriptedScene({
  slug: 'builder-manifest',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: identity.hue,
  stage: forgeStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 50, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 7_500, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    api: { name: 'build', mark: identity.mark },
    sourceDir: 'src/',
    outputDir: 'dist/',
    entries: [
      {
        name: 'index.ts',
        outputs: [
          { name: 'index.esm.js', format: 'esm', keys: ['exports'] },
          { name: 'index.cjs.js', format: 'cjs', keys: ['exports', 'main'] },
          { name: 'index.d.ts', format: 'dts', keys: ['exports', 'types'] },
          { name: 'bundle/index.iife.min.js', format: 'iife', keys: [] },
          { name: 'bundle/index.umd.min.js', format: 'umd', keys: [] },
        ],
      },
      {
        name: 'models/index.ts',
        outputs: [
          { name: 'models/index.esm.js', format: 'esm', keys: ['exports'] },
          { name: 'models/index.cjs.js', format: 'cjs', keys: ['exports'] },
          { name: 'models/index.d.ts', format: 'dts', keys: ['exports'] },
        ],
      },
    ],
    manifest: {
      name: 'package.json',
      keys: ['main', 'types', 'exports', 'files'],
      spanKey: 'files',
    },
    restMs: 1_300,
  },
})
