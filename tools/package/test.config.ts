import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the package plugin is tested.
 *
 * Only the pure parts are under test: the readme preparation and the choice
 * of libraries a version batch runs over. The executors themselves are driven
 * by Nx and exercised by every library build, and the generators by the
 * workspace's e2e suites. The modules under test are pure enough to hold to
 * full coverage.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/readme/**/*.ts', 'src/executors/version-batch/lib/select-libraries.ts'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
