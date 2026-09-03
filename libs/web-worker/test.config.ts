import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the web-worker library is tested.
 *
 * The former Jest configuration asked for a DOM, but nothing here touches one: the
 * library is a single placeholder export. It runs under plain Node.
 *
 * `src/index.ts` is measured rather than excluded as a barrel would be. It declares the
 * library's only behaviour, so exempting it would leave the project with nothing to
 * measure and a threshold that could not fail.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
