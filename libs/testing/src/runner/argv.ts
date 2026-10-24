import type { TestConfig, TestEnvironment } from './config'
import { globSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { locateRuntimeEntry } from '../lib/locate'
import { normalizePath, relativePath } from './portable-paths'

/**
 * The directory this module runs from, which is where the package's other entries are
 * found relative to.
 *
 * `__dirname` is read first so the CommonJS build locates them too; under ES modules the
 * identifier is absent and the module URL is used instead.
 */
const OWN_DIRECTORY = typeof __dirname === 'undefined' ? dirname(fileURLToPath(import.meta.url)) : __dirname

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
 * @param projectRoot - Absolute path to the project root.
 * @param coverageDir - Absolute path to the project's coverage output directory.
 * @returns The invocation plan.
 * @example Planning a project's only environment
 * ```ts
 * const resolved = withDefaults(config)
 * const plan = buildRunPlan(resolved, resolved.environments[0], '/repo/libs/example', '/repo/coverage/libs/example')
 * spawnSync(process.execPath, plan.argv, { cwd: '/repo/libs/example', stdio: 'inherit' })
 * ```
 */
export function buildRunPlan(config: TestConfig, environment: TestEnvironment, projectRoot: string, coverageDir: string): RunPlan {
  // why: `lcov.info` is reserved for the merged report the runner writes afterwards, so the raw report an environment produces is always named after it.
  const lcovPath = resolve(coverageDir, `lcov.${environment.name}.info`)

  const argv = [
    // why: every file the runner loads is TypeScript, which carries no module type of its own, and Node would warn once per file about inferring one.
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    // why: Node reads a preload or reporter value as a module specifier, and a Windows absolute path parses as a URL whose scheme is the drive letter.
    '--import',
    moduleUrl(locateRuntimeEntry('hooks', OWN_DIRECTORY)),
    // why: the DOM lands before the project's own setup files, so a setup file may assume `document` exists, and after the hooks, which it needs to resolve its own imports.
    ...(environment.dom ? ['--import', moduleUrl(locateRuntimeEntry('dom', OWN_DIRECTORY))] : []),
    ...setupPaths(environment, projectRoot).flatMap((setup) => ['--import', moduleUrl(setup)]),
    '--test',
    `--test-timeout=${config.testTimeout ?? 30_000}`,
    '--experimental-test-coverage',
    ...config.coverageInclude.map((pattern) => `--test-coverage-include=${pattern}`),
    ...(config.coverageExclude ?? []).map((pattern) => `--test-coverage-exclude=${pattern}`),
    ...(environment.testIgnore ?? []).map((pattern) => `--test-coverage-exclude=${pattern}`),
    // why: the thresholds are checked against the merged report instead, because Node counts a module evaluated twice as two files.
    `--test-reporter=${moduleUrl(locateRuntimeEntry('reporter', OWN_DIRECTORY))}`,
    '--test-reporter-destination=stdout',
    '--test-reporter=lcov',
    `--test-reporter-destination=${lcovPath}`,
    ...selectSpecFiles(environment, projectRoot),
  ]

  return { environment, argv, lcovPath: relativePath(projectRoot, lcovPath) }
}

/**
 * Renders an absolute path as the `file:` URL Node loads on every platform.
 *
 * @param path - Absolute path to a module.
 * @returns A `file:` address Node accepts as a specifier.
 * @example Rendering a preload path Node accepts on every platform
 * ```ts
 * moduleUrl('/repo/libs/example/test.setup.ts') // => 'file:///repo/libs/example/test.setup.ts'
 * // on Windows the same call turns 'C:\\repo\\test.setup.ts' into 'file:///C:/repo/test.setup.ts', where the bare path would parse as a URL with scheme 'c:'
 * ```
 */
export function moduleUrl(path: string): string {
  return pathToFileURL(path).href
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
 * @example Expanding globs only when something is ignored
 * ```ts
 * const environment = { name: 'node', testMatch: ['src/**\/*.spec.ts'] }
 * selectSpecFiles(environment, '/repo/libs/example') // => ['src/**\/*.spec.ts'], left to Node
 * selectSpecFiles({ ...environment, testIgnore: ['**\/*.browser.spec.ts'] }, '/repo/libs/example')
 * // => ['src/double.spec.ts', 'src/other.spec.ts'], expanded here because Node cannot exclude files from a glob
 * ```
 */
export function selectSpecFiles(environment: TestEnvironment, projectRoot: string): string[] {
  if (!environment.testIgnore?.length) return environment.testMatch

  // why: Node reads these arguments as globs, where only `/` means the same thing on every platform.
  const selected = globSync(environment.testMatch, { cwd: projectRoot, exclude: environment.testIgnore }).map(normalizePath).sort()
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
 * @example Anchoring setup modules to the project
 * ```ts
 * setupPaths({ name: 'node', testMatch: ['src/**\/*.spec.ts'], setupFiles: ['test.setup.ts'] }, '/repo/libs/example')
 * // => ['/repo/libs/example/test.setup.ts']
 * ```
 */
export function setupPaths(environment: TestEnvironment, projectRoot: string): string[] {
  return (environment.setupFiles ?? []).map((setup) => resolve(projectRoot, setup))
}

/**
 * Renders the mock lifecycle options for the preload, which reads them from the environment
 * because it runs in a child process.
 *
 * @param config - The project's configuration.
 * @returns The enabled steps, comma-separated, or undefined when none is enabled.
 * @example Rendering the value of `HF_TEST_MOCK_LIFECYCLE`
 * ```ts
 * serialiseMockLifecycle({ ...config, clearMocks: true, restoreMocks: true }) // => 'clear,restore'
 * ```
 */
export function serialiseMockLifecycle(config: TestConfig): string | undefined {
  const steps = [config.clearMocks && 'clear', config.resetMocks && 'reset', config.restoreMocks && 'restore'].filter(Boolean)
  return steps.length === 0 ? undefined : steps.join(',')
}

/**
 * Renders a project's `moduleNameMapper` for the resolution hooks, which read it from the
 * environment because they run in a child process.
 *
 * @param config - The project's configuration.
 * @returns The serialised pairs, or undefined when the project declares none.
 * @example Rendering the value of `HF_TEST_MODULE_MAP`
 * ```ts
 * serialiseModuleMap({ ...config, moduleNameMapper: { '^\\./real$': '<rootDir>/src/stub.ts' } })
 * // => '[["^\\\\./real$","<rootDir>/src/stub.ts"]]'
 * serialiseModuleMap(config) // => undefined when no mapping is declared
 * ```
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
 * @example Rendering the value of `HF_TEST_SETUP_FILES`
 * ```ts
 * serialiseSetupFiles({ name: 'node', testMatch: ['src/**\/*.spec.ts'], setupFiles: ['test.setup.ts'] }, '/repo/libs/example')
 * // => '["/repo/libs/example/test.setup.ts"]'
 * ```
 */
export function serialiseSetupFiles(environment: TestEnvironment, projectRoot: string): string | undefined {
  const paths = setupPaths(environment, projectRoot)
  return paths.length === 0 ? undefined : JSON.stringify(paths)
}
