/**
 * The `e2e` executor: packs the build of the library an e2e project tests, installs the tarball
 * into the project, and runs its suites on Node's built-in test runner.
 *
 * @module executors/e2e/executor
 */

import type { ExecutorContext, ExecutorResult, ProjectConfiguration } from '../../runner/contract'
import type { E2eExecutorOptions, E2eFormat } from './options'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { shimCommand } from '@hyperfrontend/project-scope/core/process'
import { readSources } from '../../hooks/index'
import { logger } from '../shared/logger'
import { BUILD_TARGET, buildOutputOf, resolveFromWorkspace } from '../shared/workspace'

/**
 * Slice of `package.json` we need when locating a built artifact's tarball.
 */
type PackageInfo = {
  /** The package name from package.json */
  name: string
  /** The package version from package.json */
  version: string
}

/**
 * Reads package info from dist package.json.
 *
 * @param distPath - The path to the dist directory containing package.json
 * @returns An object containing the package name and version
 */
function getPackageInfo(distPath: string): PackageInfo {
  const pkgPath = join(distPath, 'package.json')
  if (!existsSync(pkgPath)) {
    throw createError(`Package.json not found at ${pkgPath}. Has the library been built?`)
  }
  const pkg = parse(readFileSync(pkgPath, 'utf-8'))
  return { name: pkg.name, version: pkg.version }
}

/**
 * Runs npm pack in the dist directory and moves the tarball to tmp directory.
 *
 * @param distPath - The path to the dist directory to pack
 * @param workspaceRoot - The root directory of the workspace
 * @returns The full path to the created tarball in tmp directory
 */
function packPackage(distPath: string, workspaceRoot: string): string {
  logger.info(`Running npm pack in ${distPath}`)

  const npm = shimCommand('npm', ['pack', '--json'])
  const result = execFileSync(npm.file, npm.args, {
    cwd: distPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: npm.shell,
  })

  const packResult = parse(result)
  const tarballFilename = packResult[0]?.filename

  if (!tarballFilename) {
    throw createError('npm pack did not return a tarball filename')
  }

  const tmpDir = join(workspaceRoot, 'tmp', 'e2e-packs')
  mkdirSync(tmpDir, { recursive: true })

  const srcPath = join(distPath, tarballFilename)
  const destPath = join(tmpDir, tarballFilename)
  renameSync(srcPath, destPath)

  logger.info(`Created tarball: ${destPath}`)
  return destPath
}

/**
 * Installs the tarball in the test project directory.
 *
 * @param tarballPath - The full path to the tarball file
 * @param testDir - The test project directory where the tarball will be installed
 */
function installTarball(tarballPath: string, testDir: string): void {
  logger.info(`Installing ${tarballPath} in ${testDir}`)

  // why: the tarball sits under the workspace, whose path may hold a space, as in `C:\Users\Jane Doe`
  const npm = shimCommand('npm', ['install', tarballPath, '--save-exact'])
  execFileSync(npm.file, npm.args, { cwd: testDir, encoding: 'utf-8', stdio: 'inherit', shell: npm.shell })

  logger.info(`Installation complete`)
}

/** The package every e2e suite runs on. */
const TESTING_PACKAGE = '@hyperfrontend/testing'

/**
 * The library an e2e project tests: the first project it implicitly depends on that builds.
 *
 * @param projects - Every project's configuration by name
 * @param project - The e2e project
 * @returns The library's configuration, or undefined when the project depends on none that builds
 *
 * @example The implicit dependency that builds names the library
 * ```typescript
 * libraryUnderTest(context.projects, context.projects['e2e-core'])
 * // => context.projects['lib-core'] when e2e-core lists implicitDependencies: ['lib-core'] and lib-core has a build target
 * ```
 */
export function libraryUnderTest(
  projects: Readonly<Record<string, ProjectConfiguration>>,
  project: ProjectConfiguration
): ProjectConfiguration | undefined {
  return (project.implicitDependencies ?? [])
    .map((name) => projects[name])
    .find((library) => library?.targets?.[BUILD_TARGET] !== undefined)
}

/**
 * The path aliases of the test runtime, as the workspace declares them. A run that replaces the
 * workspace aliases outright, so a packed tarball resolves from a test project's `node_modules`,
 * still has to reach the runtime by name where the workspace serves it from source.
 *
 * @param workspaceRoot - The workspace root, absolute
 * @returns The runtime's aliases and nothing else; none in a workspace that installs the runtime
 *
 * @example Only the runtime's aliases survive
 * ```typescript
 * testingAliases(root)
 * // => { '@hyperfrontend/testing': ['libs/testing/src/index.ts'], '@hyperfrontend/testing/*': ['libs/testing/src/*'] } in the workspace that develops the runtime
 * // => {} in a workspace that installs it
 * ```
 */
export function testingAliases(workspaceRoot: string): Record<string, readonly string[]> {
  return fromEntries(
    entries(readSources(workspaceRoot).aliases).filter(([alias]) => alias === TESTING_PACKAGE || alias.startsWith(`${TESTING_PACKAGE}/`))
  )
}

/**
 * How one format runs on the node test runner.
 */
interface FormatRun {
  /** The name the run is reported under. */
  name: string
  /** The spec files the format selects, kept when they exist. */
  candidates: readonly string[]
  /** Whether the run needs the DOM preload. */
  dom: boolean
  /** The per-test timeout for the run. */
  timeoutMs: number
  /** Whether the suites run one at a time. */
  serial: boolean
}

/** The per-test timeout of a run that names none. */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * The spec files the built-in formats select, by convention.
 */
const BUILT_IN_SPECS: Readonly<Record<string, readonly string[]>> = {
  cjs: ['src/cjs.spec.ts'],
  esm: ['src/esm.spec.ts'],
  browser: ['src/iife.spec.ts', 'src/umd.spec.ts'],
}

/**
 * How a format of the target's options runs.
 *
 * @param format - A built-in format's name, or a suite the project declares itself
 * @param platform - The platform the run happens on
 * @returns The run, or undefined for a name that is no built-in format
 *
 * @example A built-in format and a declared suite
 * ```typescript
 * formatRun('browser', 'linux')
 * // => { name: 'browser', candidates: ['src/iife.spec.ts', 'src/umd.spec.ts'], dom: true, timeoutMs: 30000, serial: false }
 * formatRun({ name: 'consumer', specs: ['src/consumer.spec.ts'], timeoutMs: 120000, serialOn: ['win32'] }, 'win32')
 * // => { name: 'consumer', candidates: ['src/consumer.spec.ts'], dom: false, timeoutMs: 120000, serial: true }
 * ```
 */
export function formatRun(format: E2eFormat, platform: string): FormatRun | undefined {
  if (typeof format !== 'string')
    return {
      name: format.name,
      candidates: format.specs,
      dom: format.dom ?? false,
      timeoutMs: format.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      serial: format.serialOn?.includes(platform) ?? false,
    }
  const candidates = BUILT_IN_SPECS[format]
  return candidates === undefined
    ? undefined
    : { name: format, candidates, dom: format === 'browser', timeoutMs: DEFAULT_TIMEOUT_MS, serial: false }
}

/**
 * Runs one format's suites on the node test runner.
 *
 * The specs are the ones the format selects, by convention or by the project's own list, and run with the workspace's
 * resolution hooks installed, but with the workspace path aliases replaced by the test
 * runtime's own: the packed tarball's own name has to resolve from the test project's
 * `node_modules`, or the suite would silently exercise workspace source.
 *
 * @param testDir - The test project directory
 * @param format - The format to test: a built-in name, or a suite the project declares
 * @param workspaceRoot - The root directory of the workspace
 * @param tarballPath - The packed tarball the suites may install into an isolated consumer, when one was packed
 * @returns True if tests passed, false otherwise
 */
function runNodeTests(testDir: string, format: E2eFormat, workspaceRoot: string, tarballPath: string | undefined): boolean {
  const run = formatRun(format, process.platform)
  if (!run) {
    logger.error(`Unknown e2e format "${String(format)}"`)
    return false
  }

  const specs = run.candidates.map((candidate) => join(testDir, candidate)).filter((path) => existsSync(path))
  if (specs.length === 0) {
    logger.error(`Format "${run.name}" declares no runnable specs in ${testDir}`)
    return false
  }

  logger.info(`Running ${run.name} tests...`)

  const preloads = ['hooks', ...(run.dom ? ['dom'] : [])].map((entry) => resolveFromWorkspace(workspaceRoot, `${TESTING_PACKAGE}/${entry}`))
  if (preloads.includes(null)) {
    logger.error(`The workspace cannot resolve ${TESTING_PACKAGE}; install it to run e2e suites`)
    return false
  }

  const argv = [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    // why: Node reads a preload value as a module specifier, and a Windows absolute path parses as a URL whose scheme is the drive letter.
    ...preloads.flatMap((preload) => ['--import', pathToFileURL(preload as string).href]),
    '--test',
    `--test-timeout=${run.timeoutMs}`,
    // why: suites that each install a real consumer workspace starve one another when several run at once on a slow runner, so a project can ask for one at a time there.
    ...(run.serial ? ['--test-concurrency=1'] : []),
    ...specs,
  ]

  try {
    execFileSync(process.execPath, argv, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: 'inherit',
      env: {
        ...process.env,
        HF_TEST_WORKSPACE_ROOT: workspaceRoot,
        HF_TEST_ALIASES: stringify(testingAliases(workspaceRoot)),
        // why: the suites that drive the package under plain Node install this tarball into a directory outside the workspace, so they get its path rather than guessing it from the project's manifest.
        ...(tarballPath ? { HF_E2E_TARBALL: tarballPath } : {}),
      },
    })
    logger.info(`${run.name} tests passed`)
    return true
  } catch {
    logger.error(`${run.name} tests failed`)
    return false
  }
}

/**
 * E2E executor for testing package build outputs.
 *
 * Workflow:
 * 1. Run `npm pack` in the dist directory to create a tarball
 * 2. Install the tarball in the E2E test project
 * 3. Run each configured format's suites on the node test runner (cjs, esm, browser, and the suites the project declares)
 * 4. Optionally cleanup the tarball
 *
 * @param options - Configuration for test directory, formats, and cleanup behavior
 * @param context - The workspace, the project and the target the task runs on
 * @returns A promise resolving to an object indicating success or failure
 *
 * @example An e2e project's target, the library found through `implicitDependencies`
 * ```json
 * {
 *   "name": "e2e-core",
 *   "implicitDependencies": ["lib-core"],
 *   "targets": {
 *     "e2e": {
 *       "executor": "@hyperfrontend/workspace:e2e",
 *       "dependsOn": ["^build"],
 *       "options": {
 *         "formats": ["cjs", "esm", { "name": "consumer", "specs": ["src/consumer.spec.ts"], "timeoutMs": 120000 }]
 *       }
 *     }
 *   }
 * }
 * ```
 * `npx hf run e2e-core:e2e` packs `dist/libs/core`, installs the tarball into `e2e/core`, and runs the three suites.
 */
export async function e2eExecutor(options: E2eExecutorOptions, context: ExecutorContext): Promise<ExecutorResult> {
  const { projectName, root: workspaceRoot } = context

  if (!projectName) {
    logger.error('No project name provided')
    return { success: false }
  }

  const projectConfig = context.projects[projectName]
  if (!projectConfig) {
    logger.error(`Project ${projectName} not found in the workspace`)
    return { success: false }
  }

  const projectRoot = projectConfig.root
  const testDir = options.testDir ? join(workspaceRoot, options.testDir) : join(workspaceRoot, projectRoot)

  const library = libraryUnderTest(context.projects, projectConfig)
  if (options.packageDir === undefined && library === undefined) {
    logger.error(
      `${projectName} implicitly depends on no project with a ${BUILD_TARGET} target; name the library it tests, or set packageDir`
    )
    return { success: false }
  }
  const distPath = options.packageDir
    ? join(workspaceRoot, options.packageDir)
    : buildOutputOf(workspaceRoot, library as ProjectConfiguration)

  if (!existsSync(distPath)) {
    logger.error(`Dist path not found: ${distPath}. Has the library been built?`)
    return { success: false }
  }

  const { name: packageName, version: packageVersion } = getPackageInfo(distPath)
  logger.info(`Testing ${packageName}@${packageVersion}`)

  let tarballPath: string | undefined

  if (!options.skipInstall) {
    try {
      tarballPath = packPackage(distPath, workspaceRoot)
      installTarball(tarballPath, testDir)
    } catch (error) {
      logger.error(`Failed to pack/install: ${error}`)
      return { success: false }
    }
  }

  const formats = options.formats ?? ['cjs', 'esm', 'browser']
  const results: boolean[] = []

  for (const format of formats) {
    const success = runNodeTests(testDir, format, workspaceRoot, tarballPath)
    results.push(success)
  }

  if (tarballPath && options.cleanupTarball !== false) {
    try {
      if (existsSync(tarballPath)) {
        unlinkSync(tarballPath)
        logger.info(`Cleaned up tarball: ${tarballPath}`)
      }
    } catch (error) {
      logger.warn(`Failed to cleanup tarball: ${error}`)
    }
  }

  const allPassed = results.every(Boolean)

  if (allPassed) {
    logger.info(`All E2E tests passed for ${packageName}`)
  } else {
    logger.error(`Some E2E tests failed for ${packageName}`)
  }

  return { success: allPassed }
}
