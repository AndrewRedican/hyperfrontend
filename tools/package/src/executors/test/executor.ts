import type { ExecutorContext, PromiseExecutor } from '@hyperfrontend/integration-nx/compat'
import type { TestExecutorOptions } from './schema'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { logger } from '../../lib/logger'
import { resolveTestingEntry } from '../../lib/testing-runtime'

/**
 * The process entry the executor spawns, beside this module. It loads the project's
 * configuration and hands it to the runtime's runner.
 */
const RUNNER_CLI = join(__dirname, 'runner-cli.ts')

/**
 * Test executor for workspace projects.
 *
 * Runs the project's suites on Node's built-in test runner. The runner is started as its
 * own process so the project's `test.config.ts` is evaluated by the same runtime that
 * executes the tests, rather than by whatever TypeScript loader Nx has installed.
 *
 * @param options - Executor options naming the test configuration and coverage directory
 * @param context - Executor context providing project information
 * @returns An object indicating success or failure of the test run
 */
export default async function testExecutor(options: TestExecutorOptions, context: ExecutorContext): ReturnType<PromiseExecutor> {
  const projectName = context.projectName
  if (!projectName) {
    logger.error('No project name provided')
    return { success: false }
  }

  const projectConfig = context.projectsConfigurations?.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  const workspaceRoot = context.root
  const projectRoot = join(workspaceRoot, projectConfig.root)
  const configPath = options.testConfig ? join(workspaceRoot, options.testConfig) : join(projectRoot, 'test.config.ts')

  if (!existsSync(configPath)) {
    logger.error(`Test configuration not found: ${configPath}`)
    return { success: false }
  }

  const coverageDirectory = options.coverageDirectory
    ? join(workspaceRoot, options.coverageDirectory)
    : join(workspaceRoot, 'coverage', projectConfig.root)

  logger.info(`Testing ${projectName}...`)

  const result = spawnSync(
    process.execPath,
    [
      // why: the config and the runner are TypeScript, which carries no module type of its own, and Node would warn about inferring one for each.
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      // why: Node reads a preload value as a module specifier, and a Windows absolute path parses as a URL whose scheme is the drive letter.
      '--import',
      pathToFileURL(resolveTestingEntry(workspaceRoot, 'hooks')).href,
      RUNNER_CLI,
      workspaceRoot,
      projectRoot,
      coverageDirectory,
      configPath,
    ],
    // why: the runner process registers the resolution hooks itself, to load the project's test config, so it needs the workspace root too.
    { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, HF_TEST_WORKSPACE_ROOT: workspaceRoot } }
  )

  if (result.status !== 0) {
    logger.error(`Tests failed for ${projectName}`)
    return { success: false }
  }

  logger.info(`Tests passed for ${projectName}`)
  return { success: true }
}
