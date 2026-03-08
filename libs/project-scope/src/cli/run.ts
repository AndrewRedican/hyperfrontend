import type { Command, CommandResult, GlobalOptions } from './types'
import { parseArgs } from 'node:util'
import { error as consoleError, log } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
import { createScopedLogger, setGlobalLogLevel } from '../core/logger'
import { analyzeCommandDef } from './commands/analyze'
import { configCommandDef } from './commands/config'
import { depsCommandDef } from './commands/deps'
import { treeCommandDef } from './commands/tree'

/** Logger for CLI operations */
const cliLogger = createScopedLogger('project-scope:cli')

/** Library version */
const VERSION = '0.1.0'

/**
 * Available commands registry.
 */
const commands: Record<string, Command> = {
  analyze: analyzeCommandDef,
  config: configCommandDef,
  deps: depsCommandDef,
  tree: treeCommandDef,
}

/**
 * Print general help information.
 */
function printHelp(): void {
  log(
    `
project-scope <command> [options]

A tool for analyzing JavaScript/TypeScript project structure and tech stack.

Commands:
  analyze     Analyze project structure and tech stack
  config      Inspect configuration files
  deps        Analyze dependencies
  tree        Show file tree visualization

Global Options:
  --help, -h      Show help
  --version, -v   Show version
  --verbose       Enable verbose output
  --json          Output as JSON
  --no-color      Disable colored output

Run 'project-scope <command> --help' for detailed command help.

Examples:
  project-scope analyze
  project-scope analyze ./my-project --format json
  project-scope config --type tsconfig
  project-scope deps --type production
  project-scope tree src --depth 5
`.trim()
  )
}

/**
 * Print CLI version.
 */
function printVersion(): void {
  log(`project-scope v${VERSION}`)
}

/**
 * Parse global options from command line arguments.
 *
 * @param args - Raw command line arguments
 * @returns Parsed global options
 */
function parseGlobalOptions(args: string[]): GlobalOptions {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
      verbose: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      'no-color': { type: 'boolean', default: false },
    },
    strict: false,
    allowPositionals: true,
  })

  return {
    help: <boolean>values.help,
    version: <boolean>values.version,
    verbose: <boolean>values.verbose,
    json: <boolean>values.json,
    noColor: <boolean>values['no-color'],
  }
}

/**
 * Run CLI with given command line arguments.
 *
 * @param args - Command line arguments (typically process.argv.slice(2))
 * @returns Command result with exit code and optional output/error
 *
 * @example
 * ```typescript
 * import { run } from '@hyperfrontend/project-scope'
 *
 * // Analyze current directory
 * const result = run(['analyze'])
 *
 * // Analyze specific project with JSON output
 * const result2 = run(['analyze', './my-project', '--format', 'json'])
 *
 * // Show dependency tree
 * const result3 = run(['deps', '--type', 'production'])
 *
 * process.exit(result.exitCode)
 * ```
 */
export function run(args: string[]): CommandResult {
  if (args.length === 0) {
    printHelp()
    return { exitCode: 0 }
  }

  const globalOptions = parseGlobalOptions(args)

  if (globalOptions.verbose) {
    setGlobalLogLevel('debug')
  }

  cliLogger.debug('CLI invoked', { args, globalOptions })

  if (globalOptions.version) {
    printVersion()
    return { exitCode: 0 }
  }

  if (globalOptions.help && (args.length === 1 || !commands[args[0]])) {
    printHelp()
    return { exitCode: 0 }
  }

  const commandName = args[0]
  const command = commands[commandName]

  if (!command) {
    cliLogger.warn('Unknown command requested', { commandName })
    consoleError(`Unknown command: ${commandName}`)
    consoleError('Run "project-scope --help" for usage information.')
    return { exitCode: 1, error: `Unknown command: ${commandName}` }
  }

  if (globalOptions.help) {
    log(command.getHelp())
    return { exitCode: 0 }
  }

  const commandArgs = args.slice(1)
  cliLogger.debug('Executing command', { commandName, commandArgs })
  const result = command.execute(commandArgs, globalOptions)
  cliLogger.debug('Command completed', { commandName, exitCode: result.exitCode })

  if (result.output) {
    log(result.output)
  }
  if (result.error) {
    cliLogger.error('Command error', { commandName, error: result.error })
    consoleError(result.error)
  }

  return result
}
