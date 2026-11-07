import type { ParsedArgs } from './args'
import type { HandoverHost } from './handover'
import { parseCliArgs } from './args'
import { runBuild } from './commands/build'
import { runDev } from './commands/dev'
import { runInit } from './commands/init'
import { runServe } from './commands/serve'
import { EXIT_ERROR, EXIT_OK } from './exit-codes'
import { handOver, processHost } from './handover'
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
  /** Set by the workspace command line when it passed this invocation on, so it is not passed back. */
  readonly handedOver?: boolean
}

/** The commands this command line owns; any other first word may belong to the workspace command line. */
const COMMANDS: readonly string[] = ['init', 'build', 'dev', 'serve']

/**
 * Parses argv and dispatches to `init`, `build`, `dev`, or `serve`. `--help`
 * (and a missing command) print usage; an unknown command or flag fails with
 * usage. The returned exit code is mapped to `process.exit` by the bin bootstrap.
 *
 * The `hf` name is shared with `@hyperfrontend/workspace`. Where that package is
 * installed, a command this one does not own is passed on to its command line, and
 * the top-level usage is followed by the workspace's.
 *
 * @param options - argv, working directory, and output sinks.
 * @param host - How the workspace command line is found and loaded.
 * @returns The process exit code.
 *
 * @example Running the build command programmatically
 * ```typescript
 * const code = await runFeaturesCli({ argv: ['build', '--protocol', 'v4'], cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr })
 * ```
 */
export async function runFeaturesCli(options: RunFeaturesCliOptions, host: HandoverHost = processHost()): Promise<number> {
  const { argv, cwd, stdout, stderr } = options
  const first = argv[0]
  // why: the workspace's commands take flags this parser refuses, so a word that is no command of this package is offered to the workspace before anything is parsed
  if (options.handedOver !== true && first !== undefined && !first.startsWith('-') && !COMMANDS.includes(first)) {
    const code = await handOver(options, host)
    if (code !== null) return code
  }

  let parsed: ParsedArgs
  try {
    parsed = parseCliArgs(argv)
  } catch (error) {
    stderr.write(`${(error as Error).message}\n`)
    stderr.write(USAGE)
    return EXIT_ERROR
  }

  const { command, flags } = parsed
  if (command === undefined) {
    stdout.write(USAGE)
    if (options.handedOver !== true) await handOver({ ...options, argv: ['--help'] }, host)
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
