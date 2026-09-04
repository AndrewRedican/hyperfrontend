import type { TestConfig, TestEnvironment } from './config'
import { globSync } from 'node:fs'
import { relative, resolve } from 'node:path'

/**
 * Everything needed to build one `node --test` invocation.
 */
export type RunPlan = {
  /** The environment this invocation runs. */
  environment: TestEnvironment
  /** Arguments to pass to `node`, in order. */
  argv: string[]
  /** Where the environment's raw lcov report will be written, relative to the project root. */
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
  // why: `lcov.info` is reserved for the merged report the runner writes afterwards, so the raw report an environment produces is always named after it.
  const lcovPath = resolve(coverageDir, `lcov.${environment.name}.info`)
  const hookPath = resolve(workspaceRoot, 'tools/testing/src/hooks/register.ts')

  const argv = [
    // why: every file the runner loads is TypeScript, which carries no module type of its own, and Node would warn once per file about inferring one.
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    '--import',
    hookPath,
    // why: the DOM lands before the project's own setup files, so a setup file may assume `document` exists, and after the hooks, which it needs to resolve its own imports.
    ...(environment.dom ? ['--import', resolve(workspaceRoot, 'tools/testing/src/environment/dom.ts')] : []),
    ...setupPaths(environment, projectRoot).flatMap((setup) => ['--import', setup]),
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
    ...selectSpecFiles(environment, projectRoot),
  ]

  return { environment, argv, lcovPath: relative(projectRoot, lcovPath) }
}

/**
 * Names the files one environment runs.
 *
 * Node has no way to exclude anything from a `--test` glob, so an environment that ignores
 * files cannot express its selection as a pattern and has it expanded here instead. An
 * environment that ignores nothing keeps its globs, which leaves discovery to Node and the
 * argument list readable.
 *
 * @param environment - The environment being run.
 * @param projectRoot - Absolute path to the project root.
 * @returns The globs, or the project-relative paths they resolve to.
 * @throws {Error} When an environment that ignores files is left with nothing to run.
 */
export function selectSpecFiles(environment: TestEnvironment, projectRoot: string): string[] {
  if (!environment.testIgnore?.length) return environment.testMatch

  const selected = globSync(environment.testMatch, { cwd: projectRoot, exclude: environment.testIgnore }).sort()
  // why: Node given no files at all falls back to discovering them itself, which would silently run the very files the environment excluded.
  if (selected.length === 0) throw new Error(`environment "${environment.name}" matched no spec files`)

  return selected
}

/**
 * Resolves an environment's setup modules against the project root.
 *
 * @param environment - The environment being run.
 * @param projectRoot - Absolute path to the project root.
 * @returns One absolute path per declared setup module.
 */
export function setupPaths(environment: TestEnvironment, projectRoot: string): string[] {
  return (environment.setupFiles ?? []).map((setup) => resolve(projectRoot, setup))
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

/**
 * Renders an environment's setup modules for the resolution hooks.
 *
 * The hooks read `jest.mock` out of a file's source as it loads, and they only read it from
 * files they can recognise. A spec is recognisable by its name; a setup module is not, so
 * the runner has to name them.
 *
 * @param environment - The environment being run.
 * @param projectRoot - Absolute path to the project root.
 * @returns The serialised paths, or undefined when the environment declares none.
 */
export function serialiseSetupFiles(environment: TestEnvironment, projectRoot: string): string | undefined {
  const paths = setupPaths(environment, projectRoot)
  return paths.length === 0 ? undefined : JSON.stringify(paths)
}
