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
 * Lines and functions are the thresholds the former Jest configuration declared, unchanged;
 * Node has no statements metric, so the former statements threshold is carried by lines.
 *
 * Branches sits at 93 rather than the declared 94 for two reasons. V8 counts more branch
 * points than istanbul did, and this suite does not measure the same twice: repeated runs
 * land anywhere in 93.90 to 94.27, because the handshake and heartbeat paths take different
 * arms depending on how the timers fall. The threshold has to clear the low end of that
 * spread or it fails at random.
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
  coverageThresholds: { lines: 98, branches: 93, functions: 98 },
}

export default config
