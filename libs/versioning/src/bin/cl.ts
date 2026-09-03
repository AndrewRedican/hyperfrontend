import type { LoadCommitConfigOptions, LoadedCommitConfig } from '../commits/author/config-loader/load'
import type { Ruleset, ValidationResult } from '../commits/validate/models/ruleset'
import { readFileSync } from 'node:fs'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { loadCommitConfig } from '../commits/author'
import { conventionalPreset, validateCommitMessage } from '../commits/validate'

/** Exit code emitted when the message satisfies every error-level rule. */
export const CL_EXIT_VALID = 0

/** Exit code emitted when the message violates an error-level rule, or the bin cannot proceed. */
export const CL_EXIT_INVALID = 1

/** Parsed argv subset consumed by the `cl` bin. */
export interface ClArgs {
  /** Path to the commit message file (typically `.git/COMMIT_EDITMSG`) */
  readonly messagePath: string

  /** Explicit override for `commit.config.{js,mjs,cjs}` discovery (`--config`) */
  readonly configPath?: string

  /** Working directory override applied to config discovery (`--cwd`) */
  readonly cwdOverride?: string
}

/** Injectable dependencies for `runCl`: defaulted for production, overridden in tests. */
export interface RunClDeps {
  /** Loads the user's commit config (or returns an empty one) */
  readonly loadConfig?: (options: LoadCommitConfigOptions) => Promise<LoadedCommitConfig>

  /** Reads a commit-message file from disk */
  readonly readMessage?: (path: string) => string

  /** Validates a raw commit message against a ruleset */
  readonly validate?: (raw: string, ruleset: Ruleset) => ValidationResult
}

/** Inputs for a single `cl` invocation. */
export interface RunClOptions extends RunClDeps {
  /** Raw argv tail (excluding node + script), usually `process.argv.slice(2)` */
  readonly argv: readonly string[]

  /** Default cwd used when argv does not provide `--cwd` */
  readonly cwd: string

  /** Sink for human-facing diagnostic output (warnings and errors) */
  readonly stderr: NodeJS.WritableStream
}

/**
 * Parses the argv understood by `cl`: one positional (the commit message path)
 * and optional `--config`/`--cwd` flags. Unknown flags throw so typos surface
 * at the boundary; supplying more than one positional also throws.
 *
 * @param argv - Argument list following the bin name (e.g. `process.argv.slice(2)`)
 * @returns Parsed arguments
 *
 * @example Typical lefthook commit-msg invocation
 * ```typescript
 * parseClArgs(['.git/COMMIT_EDITMSG'])
 * // => { messagePath: '.git/COMMIT_EDITMSG' }
 * ```
 */
export function parseClArgs(argv: readonly string[]): ClArgs {
  let messagePath: string | undefined
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
    if (token === undefined || token.startsWith('--')) {
      throw createError(`Unknown argument: ${token ?? ''}`)
    }
    if (messagePath !== undefined) {
      throw createError(`Unexpected extra argument: ${token}`)
    }
    messagePath = token
  }

  if (messagePath === undefined) {
    throw createError('cl requires a commit-message file path')
  }

  return {
    messagePath,
    ...(configPath !== undefined && { configPath }),
    ...(cwdOverride !== undefined && { cwdOverride }),
  }
}

/**
 * Renders a `ValidationResult` as a multi-line human-readable report. Each
 * entry carries a leader glyph (`✖` / `⚠`) so terminal output stays scannable
 * even without color.
 *
 * @param result - Aggregated validation result
 * @returns Formatted report (empty string when there is nothing to say)
 *
 * @example Formatting a mixed result
 * ```typescript
 * formatValidationResult({
 *   valid: false,
 *   errors: [{ level: 'error', ruleName: 'type-enum', message: 'type must be one of ...' }],
 *   warnings: [{ level: 'warn', ruleName: 'header-max-length', message: 'too long' }],
 * })
 * // => "✖ type-enum: type must be one of ...\n⚠ header-max-length: too long"
 * ```
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = []
  for (const error of result.errors) {
    lines.push(`✖ ${error.ruleName}: ${error.message}`)
  }
  for (const warning of result.warnings) {
    lines.push(`⚠ ${warning.ruleName}: ${warning.message}`)
  }
  return lines.join('\n')
}

/**
 * End-to-end `cl` entry: parse argv → load config → read message → validate →
 * report. All dependencies are injectable so tests can substitute deterministic
 * stand-ins without monkey-patching `fs` or the validator.
 *
 * @param options - argv, cwd, stderr, and optional dependency overrides
 * @returns Exit code the process should terminate with
 *
 * @example Running against a commit-msg file under a lefthook hook
 * ```typescript
 * const code = await runCl({
 *   argv: process.argv.slice(2),
 *   cwd: process.cwd(),
 *   stderr: process.stderr,
 * })
 * process.exit(code)
 * ```
 */
export async function runCl(options: RunClOptions): Promise<number> {
  const { stderr } = options
  const load = options.loadConfig ?? loadCommitConfig
  const read = options.readMessage ?? ((path: string) => readFileSync(path, 'utf8'))
  const validate = options.validate ?? validateCommitMessage

  let args: ClArgs
  try {
    args = parseClArgs(options.argv)
  } catch (error) {
    stderr.write(`${(error as Error).message}\n`)
    return CL_EXIT_INVALID
  }

  const resolvedCwd = args.cwdOverride ?? options.cwd

  let raw: string
  try {
    raw = read(args.messagePath)
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return CL_EXIT_INVALID
  }

  let ruleset: Ruleset = conventionalPreset
  try {
    const loaded = await load({
      cwd: resolvedCwd,
      ...(args.configPath !== undefined && { overridePath: args.configPath }),
    })
    if (loaded.config.validateRuleset) ruleset = loaded.config.validateRuleset
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return CL_EXIT_INVALID
  }

  const result = validate(raw, ruleset)
  const report = formatValidationResult(result)
  if (report.length > 0) stderr.write(`${report}\n`)

  return result.valid ? CL_EXIT_VALID : CL_EXIT_INVALID
}
