import { panelStage } from '../src/panel/stage'
import { scanStage } from '../src/scan/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { chapter, sequenceStage } from '../src/sequence/stage'

/**
 * A repository the package was never told about, read and then changed.
 *
 * Two chapters, because one undersells it. The first is what a tool author
 * needs from a detector: point it at a checkout that nobody described to it,
 * with no configuration, without installing or running anything, and watch
 * the claims come back with their evidence and a number beside each. A beam
 * reads the tree file by file, and each finding is threaded back to the file
 * it was read from as it appears. The number is the point, because it is what
 * lets a downstream tool decide whether to act or to ask; SvelteKit at twenty
 * is the honest answer to a checkout that has a `svelte.config.js` and no
 * `@sveltejs/kit`, and a report that had rounded it to a hundred would be
 * worse than no report.
 *
 * The second chapter is what a tool can then do with that knowledge without
 * being trusted with the disk. Writes, a delete and an attempt to reach past
 * the root go into a tree that has changed nothing yet; the list of pending
 * changes is what the tool inspects; one commit lands all three, and the write
 * that tried to leave the tree never reached anything. That is the difference
 * between a generator that leaves a half-written project behind and one that
 * cannot.
 *
 * Every number in the first chapter was produced by running `analyzeProject`
 * from `libs/project-scope/src/index.ts` against
 * `apps/demos/koi-pond/fish-svelte` on 2026-09-12: Svelte 90 (`svelte` in the
 * dependencies plus `svelte.config.js`, per `tech/frontend/svelte.ts`),
 * SvelteKit 20 (the config file alone, per `tech/frontend/sveltekit.ts`),
 * Vite 95 (`vite.config.ts`) and `workspaceType: 'nx'` from the `nx.json`
 * above the package. The tree is the checkout's own. Every line in the second was
 * reproduced against the same source on 2026-09-12: `write` past the root
 * throws `Path escapes tree root: ../.npmrc`, `listChanges` returns the three
 * changes in path order with nothing on disk, and `commitChanges` reports
 * `{ created: 1, updated: 1, deleted: 1 }` before clearing the tree. `root`
 * stands for an absolute path, because `createTree` resolves every path
 * against it and a relative root is rejected as escaping itself.
 */
export default defineScriptedScene({
  slug: 'project-scope-detect',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 44,
  stage: sequenceStage,
  holdMs: 1_800,
  gif: { colours: 56, lossy: 40, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 5_200, format: 'webp', quality: 82, maxBytes: 70_000 }],
  config: {
    transitionMs: 520,
    segments: [
      chapter(
        'Read a repository it has never seen',
        scanStage,
        {
          heading: 'A checkout nobody configured it for. Nothing installed, nothing run.',
          caption: 'Every claim carries its evidence and a confidence, so your tool can act on it or ask.',
          restMs: 1_200,
          root: 'fish-svelte/',
          files: [
            { path: 'package.json', atMs: 500 },
            { path: 'svelte.config.js', atMs: 1_150 },
            { path: 'vite.config.ts', atMs: 1_800 },
            { path: 'src/', atMs: 2_400 },
            { path: '  koi/KoiStage.svelte', atMs: 2_700 },
            { path: '  koi/koi-render.ts', atMs: 3_000 },
            { path: 'tsconfig.json', atMs: 3_300 },
            { path: '../nx.json', atMs: 3_900 },
          ],
          findings: [
            { label: 'Svelte 5.56.9', evidence: 'dependencies.svelte, svelte.config.js', confidence: 90, file: 0, atMs: 850, tone: 'accent' },
            { label: 'SvelteKit', evidence: 'svelte.config.js only, no @sveltejs/kit', confidence: 20, file: 1, atMs: 1_550, tone: 'warning' },
            { label: 'Vite 8.2.1', evidence: 'vite.config.ts', confidence: 95, file: 2, atMs: 2_200, tone: 'success' },
            { label: 'Nx workspace', evidence: 'found from the root, not the package', confidence: 100, file: 7, atMs: 4_300, tone: 'success' },
          ],
        },
        700
      ),
      chapter(
        'Change it without touching disk',
        panelStage,
        {
          heading: 'Every write is staged. One commit lands them, or none does.',
          caption: 'A path that leaves the root is refused before it is even staged.',
          restMs: 1_100,
          panels: [
            {
              title: 'generate.mjs',
              kind: 'code',
              rows: [
                { text: 'const tree = createTree(root)', atMs: 200, typeMs: 560 },
                { text: '', atMs: 820 },
                { text: "tree.write('vite.config.ts', next)", atMs: 900, typeMs: 600 },
                { text: "tree.write('src/feature.ts', code)", atMs: 1_600, typeMs: 600 },
                { text: "tree.delete('src/legacy.js')", atMs: 2_300, typeMs: 480 },
                { text: "tree.write('../.npmrc', token)", atMs: 2_860, typeMs: 520 },
                { text: '', atMs: 3_460 },
                { text: 'tree.listChanges()', atMs: 3_560, typeMs: 380 },
                { text: 'commitChanges(tree)', atMs: 5_060, typeMs: 420 },
              ],
            },
            {
              title: 'what happened',
              kind: 'result',
              rows: [
                { text: 'vite.config.ts    staged', atMs: 1_580, tone: 'muted' },
                { text: 'src/feature.ts    staged', atMs: 2_280, tone: 'muted' },
                { text: 'src/legacy.js     staged', atMs: 2_840, tone: 'muted' },
                { text: 'Path escapes tree root: ../.npmrc', atMs: 3_440, marker: '›', tone: 'danger' },
                { text: '', atMs: 3_980 },
                { text: '3 pending, 0 files written', atMs: 4_020, marker: '›', tone: 'accent' },
                { text: '', atMs: 5_510 },
                { text: '{ created: 1, updated: 1, deleted: 1 }', atMs: 5_560, tone: 'success', emphasis: true },
              ],
            },
          ],
        }
      ),
    ],
  },
})
