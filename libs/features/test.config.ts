import type { TestConfig } from '@hyperfrontend/testing'

/**
 * How the features library is tested.
 *
 * The browser suites drive the host and hostee sides against a DOM; everything else runs
 * under plain Node. The two environments' coverage reports are merged, so a file only the
 * browser suites reach is still measured.
 *
 * Two Jest workarounds are gone rather than translated. The `moduleNameMapper` that
 * redirected `./module-dir` to a `__dirname` stub existed because the CommonJS test runtime
 * could not parse the `import.meta` token on the module's ES branch; native ES modules read
 * it directly, so the stub is deleted and the real module is measured. The same is true of
 * `cli/config/load-module.ts`, which was exempt because a compiled `await import()` grew
 * helper branches no test could reach.
 *
 * The thresholds are set from measurement under the stable-key coverage merge: 99.96
 * lines, 99.49 branches, 100 functions, identical on repeated runs. The former Jest
 * gate inherited the preset's flat 100, which was never satisfiable for this project.
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
    'src/shared/types.ts',
    'src/host/types.ts',
    'src/host/plugins.ts',
    'src/hostee/types.ts',
    'src/nx/model.ts',
    // why: the bin entry is a thin re-export wired to the builder bootstrap; the runner it exposes is covered by bin.spec.ts.
    'src/**/bin/**',
    // why: spec-only helpers exist to exercise other files, not to be shipped or gated themselves.
    'src/testing/**',
  ],
  coverageThresholds: { lines: 99, branches: 99, functions: 100 },
}

export default config
