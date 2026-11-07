import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How this repository's pipeline tool is tested.
 *
 * The compatibility matrix, the pipeline plan, scheduler and reports, the type extraction and
 * the artifact-drift parsers are pure derivation and are held to full coverage; the drift
 * script's npm and registry calls stay in the script. The lint-report executor is exercised by
 * every `lint:all` run.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: [
    'src/compatibility-matrix/collect.ts',
    'src/compatibility-matrix/render.ts',
    'src/compatibility-matrix/refresh.ts',
    'src/pipeline/**/*.ts',
    'src/types-extract/**/*.ts',
    'src/artifact-drift/{tar,pack,compare}.ts',
  ],
  // why: the modules under __test-utils__ build the inputs the specs read, not code the pipeline runs.
  coverageExclude: ['src/**/__test-utils__/**'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
