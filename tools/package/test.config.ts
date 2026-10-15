import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the package plugin is tested.
 *
 * Only the pure parts are under test: the readme preparation, the choice of
 * libraries a version batch runs over, the compatibility document refresh a
 * version run folds into its commit, and the text transforms that register a
 * publishable package across the workspace. The executors themselves are
 * driven by Nx and exercised by every library build, and the generators by
 * the workspace's e2e suites. The modules under test are pure enough to hold
 * to full coverage.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: [
    'src/readme/**/*.ts',
    'src/executors/version-batch/lib/select-libraries.ts',
    'src/executors/version/lib/refresh-compatibility-matrix.ts',
    'src/generators/make-publishable/lib/**/*.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
