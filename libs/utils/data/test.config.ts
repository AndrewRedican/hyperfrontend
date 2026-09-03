import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the data utilities are tested. Every source file is measured and must be fully covered.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    // why: declaration-only modules. They hold no runtime code, so no test can load them and V8 has nothing to measure.
    'src/**/*.model.ts',
    'src/models.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
