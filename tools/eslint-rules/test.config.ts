import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the workspace's ESLint rules are tested.
 *
 * The thresholds are the ones the former Jest configuration declared, unchanged. Rule code
 * is dense with narrow guards against AST shapes a parser will not produce, which is what
 * keeps the branch figure below the others.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'], setupFiles: ['test.setup.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    // why: a type-only module erases to nothing at runtime, so no test can load it and there is nothing to measure.
    'src/rules/lib-cross-platform/types.ts',
  ],
  coverageThresholds: { lines: 98, branches: 92, functions: 99 },
}

export default config
