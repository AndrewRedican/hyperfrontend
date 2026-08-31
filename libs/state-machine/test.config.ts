import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the state machine is tested.
 *
 * The excluded files are the declaration-only modules the former `coveragePathIgnorePatterns`
 * named: they hold types and constants, so there is nothing in them for a test to execute.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    'src/**/*.model.ts',
    'src/**/*.types.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
