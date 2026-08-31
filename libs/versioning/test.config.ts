import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the versioning library is tested.
 *
 * The thresholds are the ones the former Jest configuration declared, unchanged. The
 * exclusions are the same set its `coveragePathIgnorePatterns` named: the registry client
 * and its factory talk to npm, and `__test-utils__` is scaffolding the suites import
 * rather than code under test.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    'src/**/registry/models/registry.ts',
    'src/**/registry/npm/client.ts',
    'src/**/registry/factory.ts',
    'src/**/__test-utils__/**',
  ],
  coverageThresholds: { lines: 97, branches: 92, functions: 98 },
}

export default config
