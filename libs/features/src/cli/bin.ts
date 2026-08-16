import type { ParsedArgs } from './args'
import { parseCliArgs } from './args'
import { runBuild } from './commands/build'
import { runDev } from './commands/dev'
import { runInit } from './commands/init'
import { runServe } from './commands/serve'
import { EXIT_ERROR, EXIT_OK } from './exit-codes'
import { USAGE } from './usage'

/** Inputs for a single CLI invocation, matching the builder's bin bootstrap. */
export interface RunFeaturesCliOptions {
  /** Raw argv tail (excluding node + script), usually `process.argv.slice(2)`. */
  readonly argv: readonly string[]
  /** Working directory the commands resolve paths against. */
  readonly cwd: string
  /** Sink for command output (help text, success summaries). */
  readonly stdout: NodeJS.WritableStream
  /** Sink for diagnostics. */
  readonly stderr: NodeJS.WritableStream
}

/**
 * Parses argv and dispatches to `init`, `build`, `dev`, or `serve`. `--help`
 * (and a missing command) print usage; an unknown command or flag fails with
 * usage. The returned exit code is mapped to `process.exit` by the bin bootstrap.
 *
 * @param options - argv, working directory, and output sinks.
 * @returns The process exit code.
 *
 * @example Running the build command programmatically
 * ```typescript
 * const code = await runFeaturesCli({ argv: ['build', '--protocol', 'v2'], cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr })
 * ```
 */
export async function runFeaturesCli(options: RunFeaturesCliOptions): Promise<number> {
  const { argv, cwd, stdout, stderr } = options

  let parsed: ParsedArgs
  try {
    parsed = parseCliArgs(argv)
  } catch (error) {
    stderr.write(`${(<Error>error).message}\n`)
    stderr.write(USAGE)
    return EXIT_ERROR
  }

  const { command, flags } = parsed
  if (command === undefined) {
    stdout.write(USAGE)
    return flags.help ? EXIT_OK : EXIT_ERROR
  }
  if (flags.help) {
    stdout.write(USAGE)
    return EXIT_OK
  }

  const context = { flags, cwd, stdout, stderr }
  if (command === 'init') return runInit(context)
  if (command === 'build') return runBuild(context)
  if (command === 'dev') return runDev(context)
  if (command === 'serve') return runServe(context)

  stderr.write(`Unknown command: ${command}\n`)
  stderr.write(USAGE)
  return EXIT_ERROR
}
