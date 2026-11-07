/**
 * The `test` executor: runs a project's suites on Node's built-in test runner, through the test
 * runtime the workspace installs.
 *
 * @module executors/test/executor
 */

import type { ExecutorContext, ExecutorResult } from '../../runner/contract'
import type { TestExecutorOptions } from './options'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { logger } from '../shared/logger'
import { resolveFromWorkspace } from '../shared/workspace'

/** The package every project's suites run on. */
export const TESTING_PACKAGE = '@hyperfrontend/testing'

/** The entry of this package that holds the runner the executor starts in a process of its own. */
export const RUNNER_ENTRY = '@hyperfrontend/workspace/executors/test'

/**
 * What the runner process executes: it imports the entry it is handed and runs its command line
 * over the remaining arguments.
 */
const RUNNER_BOOTSTRAP =
  'const [entry, ...args] = process.argv.slice(1); const { runTestsCli } = await import(entry); process.exitCode = await runTestsCli(args)'

/**
 * Test executor for workspace projects.
 *
 * Runs the project's suites on Node's built-in test runner. The runner is started as its
 * own process so the project's `test.config.ts` is evaluated by the same runtime that
 * executes the tests, rather than by whatever TypeScript loader the calling process has installed.
 *
 * @param options - Executor options naming the test configuration and coverage directory
 * @param context - The workspace, the project and the target the task runs on
 * @returns An object indicating success or failure of the test run
 *
 * @example A `test` target reading the project's `test.config.ts`
 * ```json
 * {
 *   "targets": {
 *     "test": {
 *       "executor": "@hyperfrontend/workspace:test",
 *       "options": { "coverageDirectory": "coverage/libs/core" }
 *     }
 *   }
 * }
 * ```
 * `npx hf run lib-core:test` starts a Node.js process with `@hyperfrontend/testing/hooks` preloaded; coverage lands in `coverage/libs/core`, the default for a project at `libs/core`.
 */
export async function testExecutor(options: TestExecutorOptions, context: ExecutorContext): Promise<ExecutorResult> {
  const projectName = context.projectName
  if (!projectName) {
    logger.error('No project name provided')
    return { success: false }
  }

  const projectConfig = context.projects[projectName]
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

  const hooks = resolveFromWorkspace(workspaceRoot, `${TESTING_PACKAGE}/hooks`)
  const runner = resolveFromWorkspace(workspaceRoot, RUNNER_ENTRY)
  if (hooks === null || runner === null) {
    logger.error(
      `The workspace cannot resolve ${hooks === null ? `${TESTING_PACKAGE}/hooks` : RUNNER_ENTRY}; install ${TESTING_PACKAGE} to run tests`
    )
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
      pathToFileURL(hooks).href,
      '--input-type=module',
      '--eval',
      RUNNER_BOOTSTRAP,
      pathToFileURL(runner).href,
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
