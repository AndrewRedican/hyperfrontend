import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the string-utils library is tested.
 *
 * The package has a browser and a node implementation of the same four functions, and a
 * spec beside each importing the concrete file rather than relying on export conditions.
 * The two environments split those specs, and their coverage reports are merged, so a file
 * only one environment exercises is still measured.
 *
 * The former `jest.setup.ts` assigned `TextEncoder` and `TextDecoder` onto the global for
 * jsdom builds that lacked them. Node 24 supplies both, and the DOM preload does not
 * displace them, so it is gone.
 */
const config: TestConfig = {
  environments: [
    { name: 'node', testMatch: ['src/**/*.spec.ts'], testIgnore: ['**/browser.spec.ts'] },
    { name: 'browser', testMatch: ['src/**/browser.spec.ts'], dom: true },
  ],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    // why: sample data the suites assert against, not code under test.
    'src/lib/test-fixtures.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
