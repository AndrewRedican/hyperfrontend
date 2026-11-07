/* lint-disable workspace/lib-require-jsdoc-example */
/**
 * The command line of the process the `test` executor starts: it loads a project's test
 * configuration and hands it to the test runtime's runner. It runs with the runtime's resolution
 * hooks preloaded, so the configuration is evaluated by the same runtime that executes the tests.
 *
 * @module executors/test/runner
 */

import type { TestConfig } from '@hyperfrontend/testing/runner'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * The shape a project's test configuration module is expected to have.
 */
interface TestConfigModule {
  /** The configuration the project exports. */
  default?: TestConfig
}

/**
 * The positional arguments the executor passes through. The protocol is private to the executor
 * and this command line.
 */
interface CliArguments {
  /** Absolute path to the workspace root. */
  workspaceRoot: string
  /** Absolute path to the project root. */
  projectRoot: string
  /** Absolute path to the coverage output directory. */
  coverageDir: string
  /** Absolute path to the project's test configuration module. */
  configPath: string
}

/**
 * Reads the four positional arguments, failing early when one is missing.
 *
 * @param argv - The arguments after the entry
 * @returns The parsed arguments
 * @throws {Error} When an argument is missing
 */
function parseArguments(argv: readonly string[]): CliArguments {
  const [workspaceRoot, projectRoot, coverageDir, configPath] = argv
  if (!workspaceRoot || !projectRoot || !coverageDir || !configPath) {
    throw createError('expected <workspaceRoot> <projectRoot> <coverageDir> <configPath>')
  }
  return { workspaceRoot, projectRoot, coverageDir, configPath: resolve(configPath) }
}

/**
 * Loads a project's test configuration and runs its suites.
 *
 * @param argv - The workspace root, the project root, the coverage directory and the configuration module
 * @returns The exit code: 0 when every suite passed and the coverage thresholds held, 1 otherwise
 * @throws {Error} When an argument is missing or the configuration module has no default export
 */
export async function runTestsCli(argv: readonly string[]): Promise<number> {
  const args = parseArguments(argv)
  const loaded = (await import(pathToFileURL(args.configPath).href)) as TestConfigModule
  const config = loaded.default

  if (!config) throw createError(`${args.configPath} has no default export`)

  // why: the testing runtime is an optional peer, so this entry has to load in a workspace that never installed it
  const { runProjectTests } = await import('@hyperfrontend/testing/runner')
  const outcome = runProjectTests(config, {
    workspaceRoot: args.workspaceRoot,
    projectRoot: args.projectRoot,
    coverageDir: args.coverageDir,
  })

  // why: the table is printed here rather than by the runner, so the runner stays free of terminal output and its own suites can call it without noise.
  for (const row of outcome.coverageTable) process.stdout.write(`${row}\n`)
  for (const failure of outcome.failures) process.stderr.write(`${failure}\n`)
  return outcome.success ? 0 : 1
}
