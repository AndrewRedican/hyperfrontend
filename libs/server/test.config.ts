import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the `@hyperfrontend/server` library is tested.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    // why: a declaration-only module erases to nothing at run time, so no test can load it.
    'src/service/contract.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
