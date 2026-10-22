import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the linter is tested: every module under `src/` is held to full coverage by its own spec.
 * The scripts under `scripts/` are development tooling (the oracle, the parity diff, the parser
 * oracle, the benchmark) and are exercised by running them, not by specs.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  // why: the files under __fixtures__ are inputs the specs read, not code the linter runs; the model modules and the hook-check shapes hold types alone, so no test can load them.
  coverageExclude: [
    'src/**/*.spec.ts',
    'src/**/__fixtures__/**',
    'src/code/model.ts',
    'src/graph/model.ts',
    'src/markdown/model.ts',
    'src/rules/react-hooks/shared/check.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
