import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the ui-utils library is tested.
 *
 * Every suite here drives the DOM, which is why the environment installs one rather than
 * selecting a subset of files for it. The setup module carries what the former
 * `setupFilesAfterEach` did: the project-wide fake clock, and the replacements that make
 * the `built-in-copy` modules observable to a spy.
 */
const config: TestConfig = {
  environments: [{ name: 'browser', testMatch: ['src/**/*.spec.ts'], dom: true, setupFiles: ['test.setup.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/**/index.ts',
    // why: declaration-only modules. They hold no runtime code, so no test can load them and V8 has nothing to measure.
    'src/lib/html.model.ts',
    'src/lib/style.model.ts',
  ],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
