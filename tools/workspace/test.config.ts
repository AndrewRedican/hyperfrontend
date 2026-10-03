import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the workspace plugin is tested.
 *
 * The compatibility matrix is pure derivation over manifests on disk and is
 * held to full coverage. The lint-report executor is driven by Nx and
 * exercised by every `lint:all` run.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/compatibility-matrix/collect.ts', 'src/compatibility-matrix/render.ts', 'src/compatibility-matrix/refresh.ts'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
