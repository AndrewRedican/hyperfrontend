import type { TestConfig } from './src/runner/config'

/**
 * How the test runtime tests itself.
 *
 * The suites import `node:test` and `node:assert` directly rather than this package's own
 * `expect` and `jest`, so a defect in the runtime surfaces as a failure instead of being
 * masked by the very code under test.
 */
const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: [
    // why: a re-export barrel has no behaviour of its own; every symbol it names is covered where it is defined.
    'src/index.ts',
    // why: the process entry parses argv and awaits main(); a unit test could only re-run the runner that run.spec.ts already covers end to end.
    'src/runner/cli.ts',
  ],
  /**
   * Measured, not chosen. Each shortfall below 100 was traced to a specific construct:
   *
   * - lines: `it.failing` raising when the pinned body unexpectedly passes. Reaching it
   *   needs a nested runner, since the throw is what marks the outer test failed.
   * - branches: V8 counts the untaken side of default parameters (`precision = 2`),
   *   optional chaining (`statSync(...)?.isFile()`), and internal ternaries. Istanbul
   *   did not count these, which is why the figure reads lower than a Jest project's.
   * - functions: V8 counts inline `sort` and `filter` callbacks as functions of their own.
   */
  coverageThresholds: { lines: 99, branches: 96, functions: 97 },
}

export default config
