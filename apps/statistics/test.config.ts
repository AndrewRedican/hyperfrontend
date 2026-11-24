import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the `service-statistics` service is tested.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: src/main.ts only hands the service to the runner, which takes over the process that loads it
    'src/main.ts',
    // why: src/service.ts only hands the definition the process's own transport, clock and standard streams; src/statistics.spec.ts drives that definition through the runner with a stand-in for each
    'src/service.ts',
    // why: scaffolding the specs import, a fake npm and a stand-in process, with no behaviour of the service in it
    'src/**/__test-utils__/**',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
