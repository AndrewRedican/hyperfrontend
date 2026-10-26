import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the workspace plugin is tested.
 *
 * The compatibility matrix, the graph model, the replay harness and the type
 * extraction are pure derivation and are held to full coverage; the Nx runner the
 * replay shells out through lives in the integration package. The lint-report
 * executor is driven by Nx and exercised by every `lint:all` run.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: [
    'src/compatibility-matrix/collect.ts',
    'src/compatibility-matrix/render.ts',
    'src/compatibility-matrix/refresh.ts',
    'src/baseline/capture.ts',
    'src/baseline/replay.ts',
    'src/graph/model.ts',
    'src/graph/roles.ts',
    'src/types-extract/**/*.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
