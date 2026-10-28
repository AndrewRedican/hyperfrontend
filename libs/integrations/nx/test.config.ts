import type { TestConfig } from '@hyperfrontend/testing/runner'

/**
 * How the Nx integration package is tested. The adapters and the manifest validation carry the
 * only behaviour and are fully covered; `compat/` holds generated declarations with no runtime,
 * and the barrels re-export what is covered where it is defined.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/adapters/**/*.ts', 'src/manifests/**/*.ts'],
  // why: barrels re-export what is covered where it is defined, and a types-only module has nothing to load.
  coverageExclude: ['src/**/index.ts', 'src/manifests/model.ts'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
