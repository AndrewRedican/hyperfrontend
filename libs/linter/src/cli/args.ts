/**
 * The command line: the flags the workspace's targets and the parity harness pass, parsed by
 * hand. An unknown flag is an error, so a typo never passes silently.
 *
 * @module cli/args
 */

import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** What the command line asked for. */
export interface CliOptions {
  /** The paths to lint, as given. */
  readonly patterns: readonly string[]
  /** Whether to write fixes to disk. */
  readonly fix: boolean
  /** Whether to apply fixes without writing them, reporting the fixed text instead. */
  readonly fixDryRun: boolean
  /** The report format. */
  readonly format: 'stylish' | 'json'
  /** The number of warnings that makes the exit code 1, or -1 for no limit. */
  readonly maxWarnings: number
  /** Whether to lint standard input instead of files. */
  readonly stdin: boolean
  /** The path standard input is linted as. */
  readonly stdinFilename: string | null
  /** Whether an argument that names nothing is an error. */
  readonly errorOnUnmatchedPattern: boolean
  /** The configuration module, or null for the default. */
  readonly config: string | null
  /** Whether to print the usage and stop. */
  readonly help: boolean
}

/** Why the command line could not be read. */
export interface ArgsError {
  /** The first unknown option or bad value, in words. */
  readonly error: string
}

/** The usage text. */
export const USAGE = `usage: lint [paths...] [--fix] [--fix-dry-run] [--format stylish|json] [--max-warnings n]
            [--stdin --stdin-filename path] [--no-error-on-unmatched-pattern] [--config path] [--help]
`

/**
 * Parses the command line.
 *
 * @param argv - The arguments after the command
 * @returns The options, or the first unknown flag as an error message
 *
 * @example Read a command line
 * ```ts
 * parseArgs(['src', '--fix', '--format', 'json'])
 * // => { patterns: ['src'], fix: true, format: 'json', ... }
 * parseArgs(['--colour'])
 * // => { error: 'Unknown option --colour' }
 * ```
 */
export function parseArgs(argv: readonly string[]): CliOptions | ArgsError {
  const patterns: string[] = []
  let options: CliOptions = {
    patterns,
    fix: false,
    fixDryRun: false,
    format: 'stylish',
    maxWarnings: -1,
    stdin: false,
    stdinFilename: null,
    errorOnUnmatchedPattern: true,
    config: null,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      patterns.push(argument)
      continue
    }
    const equals = argument.indexOf('=')
    const name = equals === -1 ? argument : argument.slice(0, equals)
    const takeValue = (): string => {
      if (equals !== -1) return argument.slice(equals + 1)
      index += 1
      return argv[index] ?? ''
    }
    switch (name) {
      case '--fix':
        options = { ...options, fix: true }
        break
      case '--fix-dry-run':
        options = { ...options, fixDryRun: true }
        break
      case '--format': {
        const format = takeValue()
        if (format !== 'stylish' && format !== 'json') return { error: `Unknown format ${format}; use stylish or json` }
        options = { ...options, format }
        break
      }
      case '--max-warnings':
        options = { ...options, maxWarnings: parseInt(takeValue(), 10) }
        break
      case '--stdin':
        options = { ...options, stdin: true }
        break
      case '--stdin-filename':
        options = { ...options, stdinFilename: takeValue() }
        break
      case '--no-error-on-unmatched-pattern':
        options = { ...options, errorOnUnmatchedPattern: false }
        break
      case '--config':
        options = { ...options, config: takeValue() }
        break
      case '--help':
        options = { ...options, help: true }
        break
      default:
        return { error: `Unknown option ${name}` }
    }
  }
  return options
}
