import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the network-protocol library is tested.
 *
 * The browser suites drive the transport against a DOM; everything else runs under plain
 * Node. The two environments' coverage reports are merged, so a file only the browser
 * suites reach is still measured.
 *
 * Lines and functions are the thresholds the former Jest configuration declared, unchanged;
 * Node has no statements metric, so the former statements threshold is carried by lines.
 *
 * Branches is the one number that had to move, from 95 to 92. V8 counts more branch points
 * than istanbul did, so the same suite leaving the same code untested reads lower. The
 * fifty branches it misses are genuine error paths, mostly the queue processors' invalid
 * packet and failed transform arms, and they were untested under Jest too. Silencing them
 * with a pragma would hide real gaps rather than translate an old exemption, so the number
 * is restated instead.
 */
const config: TestConfig = {
  environments: [
    { name: 'node', testMatch: ['src/**/*.spec.ts'], testIgnore: ['**/*.browser.spec.ts'] },
    { name: 'browser', testMatch: ['src/**/*.browser.spec.ts'], dom: true },
  ],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    // why: declaration-only modules. They hold no runtime code, so no test can load them and V8 has nothing to measure.
    'src/**/model.ts',
    'src/**/*.model.ts',
    // why: doubles and sample data the suites assert against, not code under test.
    'src/**/mocks.ts',
    'src/**/test-fixtures.ts',
    // why: harnesses that wire a client and a channel together for the integration suites; the behaviour they exercise is measured in the modules they call.
    'src/integration-tests/**',
  ],
  coverageThresholds: { lines: 99, branches: 92, functions: 96 },
}

export default config
