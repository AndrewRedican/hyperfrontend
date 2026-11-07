import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the `@hyperfrontend/workspace` library is tested: the graph, the runner and the resolution
 * hook are held to full coverage by their own specs, as are the executors' helpers, the test
 * executor's decisions and the version run around the flow of `@hyperfrontend/versioning`. The command line and the executors compose them around processes they
 * start, and are exercised as an installed package by the package's e2e project.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: [
    'src/cli/handover.ts',
    'src/executors/build/root-assets.ts',
    'src/executors/shared/workspace.ts',
    'src/executors/test/executor.ts',
    'src/executors/version/lib/graph-change-sources.ts',
    'src/executors/version/lib/replace-dependency-version.ts',
    'src/executors/version/lib/run-version-for-project.ts',
    'src/executors/version/lib/shipped-change-commits.ts',
    'src/executors/version/lib/update-dependent-versions.ts',
    'src/executors/version/lib/update-e2e-dependencies.ts',
    'src/executors/version-batch/lib/base-branch.ts',
    'src/executors/version-batch/lib/rebuilt-projects.ts',
    'src/executors/version-batch/lib/select-libraries.ts',
    'src/executors/version-batch/lib/working-tree.ts',
    'src/graph/**/*.ts',
    'src/hooks/**/*.ts',
    'src/lint/**/*.ts',
    'src/runner/**/*.ts',
  ],
  // why: the modules under __test-utils__ build the inputs the specs read, not code the library runs; a barrel re-exports alone, and the contract declares types alone.
  coverageExclude: ['src/**/__test-utils__/**', 'src/graph/index.ts', 'src/lint/index.ts', 'src/runner/index.ts', 'src/runner/contract.ts'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
