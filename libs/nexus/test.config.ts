import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the nexus library is tested.
 *
 * The browser suites drive the broker and its channels against a DOM; everything else runs
 * under plain Node. The two environments' coverage reports are merged, so a file only the
 * browser suites reach is still measured.
 *
 * The setup module carries what the former `setupFilesAfterEach` did: the replacements that
 * make the `built-in-copy` modules observable to a spy, and that let a fake clock drive the
 * timers the library captured at module load. Its `TextEncoder` and `TextDecoder`
 * assignments are gone, since Node 24 supplies both and the DOM preload leaves them alone.
 *
 * Node has no statements metric, so the former statements threshold is carried by lines.
 *
 * The thresholds are set from measurement under the stable-key coverage merge, which keys
 * functions by declaration line and branches by line and branch index because the
 * reporter's anonymous-function numbers and block numbers shift between runs. Under that
 * merge this suite measures identically on repeated runs: 99.80 lines, 98.55 branches,
 * 99.66 functions. An earlier note here blamed timer-dependent handshake arms for a
 * drifting branch number; the drift was the merge splitting one branch across unstable
 * block keys, and it is gone.
 */
const config: TestConfig = {
  environments: [
    { name: 'node', testMatch: ['src/**/*.spec.ts'], testIgnore: ['**/*.browser.spec.ts'], setupFiles: ['test.setup.ts'] },
    { name: 'browser', testMatch: ['src/**/*.browser.spec.ts'], dom: true, setupFiles: ['test.setup.ts'] },
  ],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    // why: declaration-only modules. They hold no runtime code, so no test can load them and V8 has nothing to measure.
    'src/types/*.ts',
    'src/**/types.ts',
    'src/**/model.ts',
    'src/constants/event-types.ts',
    // why: the shared singleton is a module-level instance the suites replace rather than exercise.
    'src/singleton.ts',
    // why: harnesses that wire a broker and its channels together for the integration suites.
    'src/integration-tests/test-utils.ts',
  ],
  coverageThresholds: { lines: 99, branches: 98, functions: 99 },
}

export default config
