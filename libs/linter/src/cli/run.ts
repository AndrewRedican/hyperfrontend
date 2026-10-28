/**
 * The command's flow: parse the arguments, find and load the nearest configuration, pick the
 * files, lint each with the rules in effect for it (loaded on first use), write fixes, print the
 * report and answer with an exit code: 0 clean, 1 problems, 2 the command could not run or a
 * file could not be linted.
 *
 * @module cli/run
 */

import type { LintReport } from '../api/lint'
import { writeFileSync } from 'node:fs'
import { lint } from '../api/lint'
import { errorText } from '../engine/error-text'
import { formatJson } from '../output/json'
import { formatStylish } from '../output/stylish'
import { USAGE, parseArgs } from './args'

/** Where the command runs and how it talks to the world. */
export interface RunEnvironment {
  /** The working directory, which is the project root. */
  readonly cwd: string
  /** Standard input, read when `--stdin` is given. */
  readonly readStdin: () => string
  /** Writes to standard output. */
  readonly write: (text: string) => void
  /** Writes to standard error. */
  readonly writeError: (text: string) => void
}

/**
 * Runs the command.
 *
 * @param argv - The arguments after the command
 * @param environment - The working directory and streams
 * @returns The exit code
 *
 * @example Run the command inside another program
 * ```ts
 * import { run } from '@hyperfrontend/linter'
 *
 * process.exitCode = await run(['src', '--max-warnings', '0'], {
 *   cwd: process.cwd(),
 *   readStdin: () => '',
 *   write: (text) => process.stdout.write(text),
 *   writeError: (text) => process.stderr.write(text),
 * })
 * ```
 */
export async function run(argv: readonly string[], environment: RunEnvironment): Promise<number> {
  const options = parseArgs(argv)
  if ('error' in options) {
    environment.writeError(`${options.error}\n${USAGE}`)
    return 2
  }
  if (options.help) {
    environment.write(USAGE)
    return 0
  }
  if (options.stdin && (options.stdinFilename === null || options.stdinFilename === '')) {
    environment.writeError('--stdin needs --stdin-filename\n')
    return 2
  }
  if (options.stdin && options.fix) {
    environment.writeError('--fix cannot write piped-in code; use --fix-dry-run\n')
    return 2
  }
  let report: LintReport
  try {
    report = await lint({
      cwd: environment.cwd,
      patterns: options.patterns,
      config: options.config ?? undefined,
      fix: options.fix || options.fixDryRun,
      text: options.stdin ? { path: options.stdinFilename as string, text: environment.readStdin() } : undefined,
      errorOnUnmatchedPattern: options.errorOnUnmatchedPattern,
    })
  } catch (error) {
    environment.writeError(`${errorText(error)}\n`)
    const cause = innermostCause(error)
    if (cause !== null) environment.writeError(`${cause.stack}\n`)
    return 2
  }
  if (options.fix) for (const result of report.results) if (result.output !== null) writeFileSync(result.filePath, result.output)
  const results = report.results.map((result) => ({ ...result, output: options.fixDryRun ? result.output : null }))
  environment.write(options.format === 'json' ? `${formatJson(results)}\n` : formatStylish(results))
  return report.errorCount > 0 || (options.maxWarnings >= 0 && report.warningCount > options.maxWarnings) ? 1 : 0
}

/**
 * The error at the end of a failure's chain of causes, whose stack names the stage that failed.
 *
 * @param error - What the lint run threw
 * @returns The innermost cause, or null when the failure has none
 */
function innermostCause(error: unknown): Error | null {
  if (!(error instanceof Error) || !(error.cause instanceof Error)) return null
  let cause = error.cause
  while (cause.cause instanceof Error) cause = cause.cause
  return cause
}
