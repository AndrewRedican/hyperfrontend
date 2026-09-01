import type { ExecutorContext, PromiseExecutor } from '@nx/devkit'
import type { E2eExecutorOptions } from './schema'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { logger } from '../../lib/logger'

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

  const result = execFileSync('npm', ['pack', '--json'], {
    cwd: distPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
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

  execFileSync('npm', ['install', tarballPath, '--save-exact'], {
    cwd: testDir,
    encoding: 'utf-8',
    stdio: 'inherit',
  })

  logger.info(`Installation complete`)
}

/**
 * How each format runs on the node test runner: which conventional spec files it selects,
 * whether it needs a DOM, and how long one test may take.
 */
const FORMAT_RUNS: Record<string, { candidates: string[]; dom: boolean; timeoutMs: number }> = {
  cjs: { candidates: ['src/cjs.spec.ts', 'src/cli.spec.ts'], dom: false, timeoutMs: 30_000 },
  esm: { candidates: ['src/esm.spec.ts'], dom: false, timeoutMs: 30_000 },
  browser: { candidates: ['src/iife.spec.ts', 'src/umd.spec.ts'], dom: true, timeoutMs: 30_000 },
  // why: the nx suites create real consumer workspaces with a network npm install, so a single test legitimately runs for minutes.
  nx: { candidates: ['src/nx-plugin.spec.ts', 'src/nx-plugin-callbacks.spec.ts'], dom: false, timeoutMs: 900_000 },
}

/**
 * Runs one format's suites on the node test runner.
 *
 * The specs are selected by convention from the format table and run with the workspace's
 * resolution hooks installed, but with the workspace path aliases replaced by a single
 * entry for the test runtime: the packed tarball's own name has to resolve from the test
 * project's `node_modules`, or the suite would silently exercise workspace source.
 *
 * @param testDir - The test project directory
 * @param format - The module format to test (e.g., 'cjs', 'esm', 'browser')
 * @param workspaceRoot - The root directory of the workspace
 * @returns True if tests passed, false otherwise
 */
function runNodeTests(testDir: string, format: string, workspaceRoot: string): boolean {
  const run = FORMAT_RUNS[format]
  if (!run) {
    logger.error(`Unknown e2e format "${format}"`)
    return false
  }

  const specs = run.candidates.map((candidate) => join(testDir, candidate)).filter((path) => existsSync(path))
  if (specs.length === 0) {
    logger.error(`Format "${format}" declares no runnable specs in ${testDir}`)
    return false
  }

  logger.info(`Running ${format} tests...`)

  const argv = [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    '--import',
    join(workspaceRoot, 'tools/testing/src/hooks/register.ts'),
    ...(run.dom ? ['--import', join(workspaceRoot, 'tools/testing/src/environment/dom.ts')] : []),
    '--test',
    `--test-timeout=${run.timeoutMs}`,
    ...specs,
  ]

  try {
    execFileSync('node', argv, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: 'inherit',
      env: {
        ...process.env,
        HF_TEST_WORKSPACE_ROOT: workspaceRoot,
        HF_TEST_ALIASES: JSON.stringify({ '@hyperfrontend/testing': ['tools/testing/src/index.ts'] }),
      },
    })
    logger.info(`${format} tests passed`)
    return true
  } catch {
    logger.error(`${format} tests failed`)
    return false
  }
}

/**
 * Runs Jest tests for a specific format.
 *
 * This is the legacy path for projects still carrying `jest.config.<format>.ts` files;
 * a project whose configs are deleted runs on the node test runner instead. It goes away
 * with the last per-project Jest install.
 *
 * @param testDir - The test project directory
 * @param format - The module format to test (e.g., 'cjs', 'esm', 'browser')
 * @param workspaceRoot - The root directory of the workspace
 * @returns True if tests passed, false otherwise
 */
function runJestTests(testDir: string, format: string, workspaceRoot: string): boolean {
  const configPath = join(testDir, `jest.config.${format}.ts`)

  if (!existsSync(configPath)) {
    return runNodeTests(testDir, format, workspaceRoot)
  }

  logger.info(`Running ${format} tests...`)

  try {
    execFileSync('npx', ['jest', '--config', configPath, '--passWithNoTests'], {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: 'inherit',
    })
    logger.info(`${format} tests passed`)
    return true
  } catch {
    logger.error(`${format} tests failed`)
    return false
  }
}

/**
 * E2E executor for testing package build outputs.
 *
 * Workflow:
 * 1. Run `npm pack` in the dist directory to create a tarball
 * 2. Install the tarball in the E2E test project
 * 3. Run Jest tests for each configured format (cjs, esm, browser)
 * 4. Optionally cleanup the tarball
 *
 * @param options - Configuration for test directory, formats, and cleanup behavior
 * @param context - The Nx executor context
 * @returns A promise resolving to an object indicating success or failure
 */
export default async function e2eExecutor(options: E2eExecutorOptions, context: ExecutorContext): ReturnType<PromiseExecutor> {
  const { projectName, root: workspaceRoot, projectGraph } = context

  if (!projectName) {
    logger.error('No project name provided')
    return { success: false }
  }

  const projectConfig = projectGraph?.nodes[projectName]?.data
  if (!projectConfig) {
    logger.error(`Project ${projectName} not found in project graph`)
    return { success: false }
  }

  const projectRoot = projectConfig.root
  const testDir = options.testDir ? join(workspaceRoot, options.testDir) : join(workspaceRoot, projectRoot)

  const libName = projectName.replace(/^e2e-lib-/, '')
  const utilsMatch = libName.match(/^(.+)-utils$/)
  let distPath: string
  if (options.packageDir) {
    distPath = join(workspaceRoot, options.packageDir)
  } else if (utilsMatch) {
    distPath = join(workspaceRoot, 'dist', 'libs', 'utils', utilsMatch[1])
  } else {
    distPath = join(workspaceRoot, 'dist', 'libs', libName)
  }

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
    const success = runJestTests(testDir, format, workspaceRoot)
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
