import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the workspace plugin is tested.
 *
 * The compatibility matrix, the workspace graph, the replay harness, the comparison
 * classifier and report, the type extraction and the artifact-drift parsers are pure derivation and are held to full
 * coverage; the Nx runner the replay shells out through lives in the integration
 * package, and the drift script's npm and registry calls stay in the script. The
 * lint-report executor is driven by Nx and exercised by every `lint:all` run.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: [
    'src/compatibility-matrix/collect.ts',
    'src/compatibility-matrix/render.ts',
    'src/compatibility-matrix/refresh.ts',
    'src/baseline/capture.ts',
    'src/baseline/replay.ts',
    'src/graph/**/*.ts',
    'src/compare/**/*.ts',
    'src/types-extract/**/*.ts',
    'src/artifact-drift/{tar,pack,compare}.ts',
  ],
  // why: the modules under __test-utils__ build the inputs the specs read, not code the graph runs; the graph's barrel re-exports alone.
  coverageExclude: ['src/**/__test-utils__/**', 'src/graph/index.ts'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
