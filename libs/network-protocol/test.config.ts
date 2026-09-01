import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the network-protocol library is tested.
 *
 * The browser suites drive the transport against a DOM; everything else runs under plain
 * Node. The two environments' coverage reports are merged, so a file only the browser
 * suites reach is still measured.
 *
 * Node has no statements metric, so the former statements threshold is carried by lines.
 *
 * The thresholds are set from measurement under the stable-key coverage merge: 99.81
 * lines, 98.95 branches, 98.16 functions, identical on repeated runs. The branches this
 * suite still misses are genuine error paths, mostly the queue processors' invalid packet
 * and failed transform arms, and they were untested under Jest too; silencing them with a
 * pragma would hide real gaps.
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
  coverageThresholds: { lines: 99, branches: 98, functions: 98 },
}

export default config
