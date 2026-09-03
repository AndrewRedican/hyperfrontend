import type { TestConfig } from './config'
import { resolve } from 'node:path'
import { runProjectTests } from './run'

/**
 * The shape a project's test configuration module is expected to have.
 */
type TestConfigModule = {
  /** The configuration the project exports. */
  default?: TestConfig
}

/**
 * Positional arguments the executor passes through.
 */
type CliArguments = {
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
 * @param argv - The raw arguments, excluding the executable and script.
 * @returns The parsed arguments.
 */
function parseArguments(argv: string[]): CliArguments {
  const [workspaceRoot, projectRoot, coverageDir, configPath] = argv
  if (!workspaceRoot || !projectRoot || !coverageDir || !configPath) {
    throw new Error('Usage: cli.ts <workspaceRoot> <projectRoot> <coverageDir> <configPath>')
  }
  return { workspaceRoot, projectRoot, coverageDir, configPath: resolve(configPath) }
}

/**
 * Loads a project's test configuration and runs its suites.
 *
 * This runs as its own process so the configuration is evaluated by the same runtime that
 * will execute the tests, rather than by whatever loader Nx happens to have installed.
 */
async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const loaded = (await import(args.configPath)) as TestConfigModule
  const config = loaded.default

  if (!config) throw new Error(`${args.configPath} has no default export`)

  const outcome = runProjectTests(config, {
    workspaceRoot: args.workspaceRoot,
    projectRoot: args.projectRoot,
    coverageDir: args.coverageDir,
  })

  // why: the table is printed here rather than by the runner, so the runner stays free of terminal output and its own suites can call it without noise.
  for (const row of outcome.coverageTable) process.stdout.write(`${row}\n`)
  for (const failure of outcome.failures) process.stderr.write(`${failure}\n`)
  if (!outcome.success) process.exitCode = 1
}

await main()
