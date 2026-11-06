import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the `@hyperfrontend/workspace` library is tested: the graph, the runner and the resolution
 * hook are held to full coverage by their own specs, as are the executors' helpers and the test
 * executor's decisions. The command line and the executors compose them around processes they
 * start, and are exercised as an installed package by the package's e2e project.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: [
    'src/cli/handover.ts',
    'src/executors/build/root-assets.ts',
    'src/executors/shared/workspace.ts',
    'src/executors/test/executor.ts',
    'src/graph/**/*.ts',
    'src/hooks/**/*.ts',
    'src/runner/**/*.ts',
  ],
  // why: the modules under __test-utils__ build the inputs the specs read, not code the library runs; a barrel re-exports alone, and the contract declares types alone.
  coverageExclude: ['src/**/__test-utils__/**', 'src/graph/index.ts', 'src/runner/index.ts', 'src/runner/contract.ts'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
