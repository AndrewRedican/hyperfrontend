import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the package plugin is tested.
 *
 * Only the readme preparation is under test: the executors themselves are
 * driven by Nx and exercised by every library build, and the generators by the
 * workspace's e2e suites. The readme modules are pure enough to hold to full
 * coverage.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/readme/**/*.ts'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
