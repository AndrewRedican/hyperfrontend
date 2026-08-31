import type { PartialSessionConfig } from '../commits/author/models/session-config'
import type { SessionOutcome } from '../commits/author/models/session-outcome'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createAuthorSession, loadCommitConfig, runAuthorSession, SessionStatusValues } from '../commits/author'

/** Exit code emitted when the session produced a commit. */
export const EXIT_COMMITTED = 0

/** Exit code emitted for any error-tagged cancellation (empty staging, commit failure, argv error). */
export const EXIT_ERROR = 1

/** Exit code emitted when the user cancels the session (SIGINT). */
export const EXIT_SIGINT = 130

/** Parsed argv subset consumed by the `cz` bin. */
export interface CzArgs {
  /** Explicit override for `commit.config.{js,mjs,cjs}` discovery (`--config`) */
  readonly configPath?: string

  /** Working directory override applied to both config discovery and the session (`--cwd`) */
  readonly cwdOverride?: string
}

/** Injectable dependencies for `runCz`: defaulted for production, overridden in tests. */
export interface RunCzDeps {
  /** Loads the user's commit config (or returns an empty one) */
  readonly loadConfig?: typeof loadCommitConfig

  /** Prepares an authoring session from the resolved config */
  readonly createSession?: typeof createAuthorSession

  /** Executes the prepared session and returns its outcome */
  readonly runSession?: typeof runAuthorSession
}

/** Inputs for a single `cz` invocation. */
export interface RunCzOptions extends RunCzDeps {
  /** Raw argv tail (excluding node + script), usually `process.argv.slice(2)` */
  readonly argv: readonly string[]

  /** Default cwd used when argv does not provide `--cwd` */
  readonly cwd: string

  /** Sink for diagnostic output (argv errors, cancellation messages) */
  readonly stderr: NodeJS.WritableStream
}

/**
 * Parses the short argv flag set understood by `cz`. Unknown flags and
 * flag-without-value pairs throw so typos fail at the boundary instead of
 * silently skipping configuration.
 *
 * @param argv - Argument list following the bin name (e.g. `process.argv.slice(2)`)
 * @returns Parsed arguments
 *
 * @example Parsing with an explicit config path
 * ```typescript
 * parseCzArgs(['--config', './my.config.cjs'])
 * // => { configPath: './my.config.cjs' }
 * ```
 */
export function parseCzArgs(argv: readonly string[]): CzArgs {
  let configPath: string | undefined
  let cwdOverride: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--config') {
      const value = argv[i + 1]
      if (value === undefined) throw createError('--config requires a path')
      configPath = value
      i++
      continue
    }
    if (token === '--cwd') {
      const value = argv[i + 1]
      if (value === undefined) throw createError('--cwd requires a path')
      cwdOverride = value
      i++
      continue
    }
    throw createError(`Unknown argument: ${token ?? ''}`)
  }

  return {
    ...(configPath !== undefined && { configPath }),
    ...(cwdOverride !== undefined && { cwdOverride }),
  }
}

/**
 * Maps a `SessionOutcome` to the process exit code per Phase 6:
 *   - `committed` → 0
 *   - `cancelled` carrying an error → 1 (empty staging, commit failure, ...)
 *   - `cancelled` without an error → 130 (clean Ctrl-C)
 *
 * When an error is attached its message is echoed to `stderr` so the user
 * has actionable context even when stdout has been consumed by prompts.
 *
 * @param outcome - Terminal outcome returned by `runAuthorSession`
 * @param stderr - Stream used for the diagnostic echo
 * @returns Process exit code
 *
 * @example Mapping a clean user cancellation
 * ```typescript
 * outcomeToExit({ status: 'cancelled' }, process.stderr)
 * // => 130
 * ```
 */
export function outcomeToExit(outcome: SessionOutcome, stderr: NodeJS.WritableStream): number {
  if (outcome.status === SessionStatusValues.Committed) return EXIT_COMMITTED
  if (outcome.error) {
    stderr.write(`${outcome.error.message}\n`)
    return EXIT_ERROR
  }
  return EXIT_SIGINT
}

/**
 * End-to-end `cz` entry: parse argv → load config → create session → run →
 * translate outcome into an exit code. All dependencies are injectable so
 * tests can substitute deterministic stand-ins without monkey-patching.
 *
 * @param options - argv, cwd, stderr, and optional dependency overrides
 * @returns Exit code the process should terminate with
 *
 * @example Running with the production defaults
 * ```typescript
 * const code = await runCz({
 *   argv: process.argv.slice(2),
 *   cwd: process.cwd(),
 *   stderr: process.stderr,
 * })
 * process.exit(code)
 * ```
 */
export async function runCz(options: RunCzOptions): Promise<number> {
  const { stderr } = options
  const load = options.loadConfig ?? loadCommitConfig
  const create = options.createSession ?? createAuthorSession
  const run = options.runSession ?? runAuthorSession

  let args: CzArgs
  try {
    args = parseCzArgs(options.argv)
  } catch (error) {
    stderr.write(`${(error as Error).message}\n`)
    return EXIT_ERROR
  }

  const resolvedCwd = args.cwdOverride ?? options.cwd

  try {
    const loaded = await load({
      cwd: resolvedCwd,
      ...(args.configPath !== undefined && { overridePath: args.configPath }),
    })

    const merged: PartialSessionConfig = { ...loaded.config, cwd: resolvedCwd }
    const session = create({ config: merged })
    const outcome = await run(session)
    return outcomeToExit(outcome, stderr)
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT_ERROR
  }
}
