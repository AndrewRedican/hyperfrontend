/**
 * Coverage percentages a run must reach to pass.
 *
 * Node measures lines, branches, and functions. It has no statements metric, so a
 * project's former statements threshold is carried by `lines`.
 */
export type CoverageThresholds = {
  /** Minimum percentage of lines executed. */
  lines?: number
  /** Minimum percentage of branches taken. */
  branches?: number
  /** Minimum percentage of functions entered. */
  functions?: number
}

/**
 * One environment a project's tests run under.
 *
 * A project with both Node-only and DOM-facing suites declares two, each selecting its
 * own files and loading its own setup.
 */
export type TestEnvironment = {
  /** Identifier used in output and in the coverage file name. */
  name: string
  /** Globs, relative to the project root, selecting this environment's spec files. */
  testMatch: string[]
  /** Globs excluded from `testMatch`. */
  testIgnore?: string[]
  /** Whether a DOM is installed on the global before the suites run. */
  dom?: boolean
  /** Modules preloaded before the suites, the equivalent of `setupFilesAfterEach`. */
  setupFiles?: string[]
}

/**
 * A project's test configuration, replacing what `jest.config.ts` used to hold.
 */
export type TestConfig = {
  /** Environments to run, in order. */
  environments: TestEnvironment[]
  /** Globs, relative to the project root, naming every file that must be measured. */
  coverageInclude: string[]
  /** Globs naming files exempt from measurement. */
  coverageExclude?: string[]
  /** Percentages the run must reach. */
  coverageThresholds?: CoverageThresholds
  /** Specifier patterns redirected before normal resolution, like Jest's `moduleNameMapper`. */
  moduleNameMapper?: Record<string, string>
  /** Per-test timeout in milliseconds. */
  testTimeout?: number
}

/**
 * Spec files are never part of what coverage measures, and neither is the configuration
 * that selects them. Every project inherits these exclusions so no project has to repeat
 * them.
 */
export const BASELINE_COVERAGE_EXCLUDE = ['**/*.spec.ts', '**/*.spec.tsx', '**/*.d.ts', 'test.config.ts']

/**
 * Fills in the defaults a project does not state.
 *
 * @param config - The configuration as authored.
 * @returns The configuration with baseline exclusions and a timeout applied.
 */
export function withDefaults(config: TestConfig): Required<Pick<TestConfig, 'coverageExclude' | 'testTimeout'>> & TestConfig {
  return {
    ...config,
    coverageExclude: [...BASELINE_COVERAGE_EXCLUDE, ...(config.coverageExclude ?? [])],
    testTimeout: config.testTimeout ?? 30_000,
  }
}
