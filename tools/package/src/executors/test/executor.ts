import type { ExecutorContext, PromiseExecutor } from '@nx/devkit'
import type { TestExecutorOptions } from './schema'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '../../lib/logger'

/**
 * Where the test runtime lives, relative to the workspace root.
 */
const RUNTIME_ROOT = join('tools', 'testing', 'src')

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
      '--import',
      join(workspaceRoot, RUNTIME_ROOT, 'hooks', 'register.ts'),
      join(workspaceRoot, RUNTIME_ROOT, 'runner', 'cli.ts'),
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
