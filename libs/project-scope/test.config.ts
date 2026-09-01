import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the project-scope library is tested.
 *
 * The thresholds are the ones the former Jest configuration declared, unchanged. The
 * fixtures are sample projects the suites analyse rather than code under test, which is
 * the exclusion its `coveragePathIgnorePatterns` named.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    '__fixtures__/**',
    // why: declaration-only modules. They hold no runtime code, so no test can load them and V8 has nothing to measure. `src/vfs/types.ts` is not among them, since it declares a value.
    'src/cli/types.ts',
    'src/tech/*/types.ts',
  ],
  coverageThresholds: { lines: 98, branches: 93, functions: 98 },
}

export default config
