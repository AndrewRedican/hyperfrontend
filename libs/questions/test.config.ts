import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the question prompts are tested.
 *
 * The thresholds are the ones the former Jest configuration declared, unchanged. This
 * library drives a terminal, and the paths a test cannot reach are the ones that depend on
 * a real TTY.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
  ],
  coverageThresholds: { lines: 98, branches: 93, functions: 100 },
}

export default config
