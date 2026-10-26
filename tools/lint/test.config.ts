import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the workspace's lint integration is tested: every module under `src/` and `config/` is held to full coverage by its own spec.
 * The scripts under `scripts/` are development tooling (the oracle, the parity diff, the parser
 * oracle, the benchmark) and are exercised by running them, not by specs.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts', 'config/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts', 'config/**/*.ts'],
  // why: the modules under __test-utils__ build the inputs the specs read, not code the linter runs.
  coverageExclude: [
    'src/**/*.spec.ts',
    'config/**/*.spec.ts',
    'src/**/__test-utils__/**',
    // why: the workspace's settings hold data alone, so no test has behaviour of theirs to run.
    'config/rule-sets.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
