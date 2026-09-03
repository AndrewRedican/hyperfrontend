import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the cryptography library is tested.
 *
 * Each primitive has a WebCrypto implementation and a `node:crypto` one, with a spec beside
 * each importing the concrete file. The two environments split those specs, and their
 * coverage reports are merged, so a file only one environment exercises is still measured.
 *
 * The former `jest.setup.browser.ts` put Node's `webcrypto` back on the global, because
 * jsdom's `crypto` has no `subtle` and the browser implementations are written against it.
 * The DOM preload never takes Node's away, so it has no work left.
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
    // why: declaration-only modules. They hold no runtime code, so no test can load them and V8 has nothing to measure.
    'src/lib/**/model.ts',
    'src/lib/encryption-config.model.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
