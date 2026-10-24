import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the `@hyperfrontend/linter` library is tested.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    // why: the modules under __test-utils__ hold the inputs the specs read and the code that writes them out, not code the linter runs.
    'src/**/__test-utils__/**',
    // why: these modules hold types alone, so no test can load them.
    'src/code/model.ts',
    'src/markdown/model.ts',
    'src/languages/json-tree.ts',
    'src/rules/react-hooks/shared/check.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
