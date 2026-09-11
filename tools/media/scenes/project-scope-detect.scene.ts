import { gaugeStage } from '../src/gauge/stage'
import { defineScriptedScene } from '../src/scene/define-scene'

/**
 * A repository nobody described, read without being run.
 *
 * The thing a tool author actually needs from this package is not a list of
 * detections, it is the confidence beside each one, because that is what lets
 * a tool decide whether to act or to ask. So the dials are the frame: four
 * directories go in and come back as claims with numbers on them, and one of
 * them is deliberately weak. SvelteKit at twenty is the honest answer to a
 * repository that has a Svelte dependency and no SvelteKit routing, and a
 * report that had rounded it up to a hundred would be worse than no report.
 *
 * Nothing here was installed, built or executed to produce these: the analysis
 * is static, and the timings under the dials are what four of the koi pond's
 * fish apps really took.
 *
 * Every number was produced by running `analyzeProject` from
 * `libs/project-scope/src/index.ts` against
 * `apps/demos/koi-pond/fish-{react,vue,svelte,angular}` on 2026-09-10 and
 * reading `frameworks[].confidence`, `buildTools[].confidence` and
 * `metadata.durationMs` off the reports.
 */
export default defineScriptedScene({
  slug: 'project-scope-detect',
  asset: 'hero',
  outputs: ['gif', 'still'],
  profile: 'docs-wide',
  stage: gaugeStage,
  holdMs: 1_800,
  gif: { colours: 48, lossy: 75, maxBytes: 900_000 },
  stills: [{ name: 'poster', atMs: 6_200, format: 'webp', quality: 82, maxBytes: 80_000 }],
  config: {
    theme: 'midnight',
    heading: 'analyzeProject(dir) on four repositories nobody described',
    caption: 'Static analysis: nothing was installed, nothing was built, nothing was run.',
    restMs: 1_700,
    groups: [
      {
        title: 'Frameworks',
        tracks: [
          { label: 'React 19.2.8', max: 100, unit: '%', tone: 'accent', note: 'fish-react, read in 65ms', stops: fill(700, 80) },
          { label: 'Vue 3.5.41', max: 100, unit: '%', tone: 'accent', note: 'fish-vue, read in 86ms', stops: fill(1_100, 70) },
          { label: 'Svelte 5.56.9', max: 100, unit: '%', tone: 'accent', note: 'fish-svelte, read in 45ms', stops: fill(1_500, 90) },
          { label: 'Angular 22.1.2', max: 100, unit: '%', tone: 'accent', note: 'fish-angular, read in 132ms', stops: fill(1_900, 70) },
          { label: 'SvelteKit', max: 100, unit: '%', tone: 'warning', note: 'the dependency, not the router', stops: fill(3_400, 20) },
        ],
      },
      {
        title: 'Build tooling',
        tracks: [
          { label: 'Vite 8.2.1', max: 100, unit: '%', tone: 'success', note: 'vite.config.ts, fish-react', stops: fill(2_400, 100) },
          { label: 'Vite 8.2.1', max: 100, unit: '%', tone: 'success', note: 'vite.config.ts, fish-svelte', stops: fill(2_700, 95) },
          {
            label: 'Nx workspace',
            max: 100,
            unit: '%',
            tone: 'success',
            note: 'found from the root, not the package',
            stops: fill(4_400, 100),
          },
          { label: 'test runner', max: 100, unit: '%', tone: 'muted', note: 'none of the four ships one', stops: fill(5_200, 0) },
        ],
      },
    ],
  },
})

/**
 * A dial that starts empty and settles on one number.
 *
 * Every detection arrives the same way and differs only in when and how far,
 * so the two-stop ramp is written once rather than five times.
 *
 * @param atMs - When the dial starts filling.
 * @param value - The confidence it settles on.
 * @returns The two stops the track interpolates between.
 */
function fill(atMs: number, value: number) {
  return [
    { atMs, value: 0 },
    { atMs: atMs + 900, value },
  ]
}
