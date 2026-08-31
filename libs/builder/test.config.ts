import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the builder is tested.
 *
 * The thresholds are the ones the former Jest configuration declared, unchanged. The
 * exclusions are the same set its `coveragePathIgnorePatterns` named: declaration-only
 * modules, and the worker entry points, which run in a child process the parent measures
 * through its output rather than through coverage.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    'src/models/**',
    'src/**/*.types.ts',
    'src/package/licenses/types.ts',
    'src/bundle/rollup/worker/types.ts',
    'src/bin/native/worker/types.ts',
    'src/bundle/dependencies/worker/job-runner.ts',
    'src/bundle/rollup/worker/job-runner.ts',
    'src/bin/native/worker/job-runner.ts',
  ],
  coverageThresholds: { lines: 99, branches: 96, functions: 98 },
}

export default config
