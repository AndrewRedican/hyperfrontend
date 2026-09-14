import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the recorder is tested.
 *
 * Under test is everything that decides what an asset is without a browser:
 * theme resolution, the sequence timeline, variant selection, the frame-run
 * passes the encoder makes, scene discovery and the audit check, plus the
 * project file's promise that nothing generates media unless asked to. What
 * drives a browser or a video is exercised by recording a scene, which is what
 * the `preview` and `media` targets are for.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts', 'project.spec.ts'] }],
  coverageInclude: [
    'src/cli/moments.ts',
    'src/cli/commands/check.ts',
    'src/config/load-config.ts',
    'src/encode/runs.ts',
    'src/pipeline/variants.ts',
    'src/scene/discover.ts',
    'src/sequence/**/*.ts',
    'src/stage/document.ts',
    'src/theme/**/*.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
