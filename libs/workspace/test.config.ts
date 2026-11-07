import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the `@hyperfrontend/workspace` library is tested: every module has specs of its own, and
 * the package's e2e project runs the installed command line, executors and generators as a
 * consumer would. What the unit suite leaves short of full coverage is the git plumbing of the
 * version executors, which the e2e project's release flow drives for real.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  // why: the modules under __test-utils__ build the inputs the specs read, not code the library runs; a barrel re-exports alone, and the contract and the generators' options declare types alone; the e2e and publish executors are shells around npm processes, which the package's e2e project runs for real.
  coverageExclude: [
    'src/**/__test-utils__/**',
    'src/executors/e2e/executor.ts',
    'src/executors/publish/executor.ts',
    'src/generators/index.ts',
    'src/generators/*/index.ts',
    'src/generators/*/options.ts',
    'src/graph/index.ts',
    'src/lint/index.ts',
    'src/runner/index.ts',
    'src/runner/contract.ts',
  ],
  coverageThresholds: { lines: 99, branches: 100, functions: 98 },
}

export default config
