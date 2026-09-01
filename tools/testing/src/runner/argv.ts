import type { TestConfig, TestEnvironment } from './config'
import { relative, resolve } from 'node:path'

/**
 * Everything needed to build one `node --test` invocation.
 */
export type RunPlan = {
  /** The environment this invocation runs. */
  environment: TestEnvironment
  /** Arguments to pass to `node`, in order. */
  argv: string[]
  /** Where the lcov report will be written, relative to the project root. */
  lcovPath: string
}

/**
 * Builds the argument list for one environment's run.
 *
 * Coverage is always collected: every project used to inherit `collectCoverage: true`
 * from the shared preset, so making it conditional would quietly weaken the gate.
 *
 * @param config - The project's configuration, with defaults already applied.
 * @param environment - The environment to run.
 * @param workspaceRoot - Absolute path to the workspace root.
 * @param projectRoot - Absolute path to the project root.
 * @param coverageDir - Absolute path to the project's coverage output directory.
 * @returns The invocation plan.
 */
export function buildRunPlan(
  config: TestConfig,
  environment: TestEnvironment,
  workspaceRoot: string,
  projectRoot: string,
  coverageDir: string
): RunPlan {
  const lcovPath = resolve(coverageDir, config.environments.length > 1 ? `lcov.${environment.name}.info` : 'lcov.info')
  const hookPath = resolve(workspaceRoot, 'tools/testing/src/hooks/register.ts')

  const argv = [
    // why: every file the runner loads is TypeScript, which carries no module type of its own, and Node would warn once per file about inferring one.
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    '--import',
    hookPath,
    ...(environment.setupFiles ?? []).flatMap((setup) => ['--import', resolve(projectRoot, setup)]),
    '--test',
    `--test-timeout=${config.testTimeout ?? 30_000}`,
    '--experimental-test-coverage',
    ...config.coverageInclude.map((pattern) => `--test-coverage-include=${pattern}`),
    ...(config.coverageExclude ?? []).map((pattern) => `--test-coverage-exclude=${pattern}`),
    ...(environment.testIgnore ?? []).map((pattern) => `--test-coverage-exclude=${pattern}`),
    // why: the thresholds are checked against the merged report instead, because Node counts a module evaluated twice as two files.
    `--test-reporter=${resolve(workspaceRoot, 'tools/testing/src/runner/reporter.ts')}`,
    '--test-reporter-destination=stdout',
    '--test-reporter=lcov',
    `--test-reporter-destination=${lcovPath}`,
    ...environment.testMatch,
  ]

  return { environment, argv, lcovPath: relative(projectRoot, lcovPath) }
}

/**
 * Renders a project's `moduleNameMapper` for the resolution hooks, which read it from the
 * environment because they run in a child process.
 *
 * @param config - The project's configuration.
 * @returns The serialised pairs, or undefined when the project declares none.
 */
export function serialiseModuleMap(config: TestConfig): string | undefined {
  const entries = Object.entries(config.moduleNameMapper ?? {})
  return entries.length === 0 ? undefined : JSON.stringify(entries)
}
