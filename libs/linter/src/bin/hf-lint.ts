/**
 * The `hf-lint` command: lint the working directory, or the paths given, with the nearest
 * `lint.config.ts`, print the report and set the exit code.
 *
 * @module bin/hf-lint
 */

import { readFileSync } from 'node:fs'
import { run } from '../cli/run'

/** A stream the command writes text to. */
export interface TextSink {
  /**
   * Writes text.
   *
   * @param text - What to write
   * @returns Whatever the stream answers, ignored
   */
  write(text: string): unknown
}

/** The process the command runs in. */
export interface HfLintProcess {
  /** The arguments after the command. */
  readonly argv: readonly string[]
  /** The working directory. */
  readonly cwd: string
  /** Where standard input is read from when `--stdin` asks for it: a file descriptor, 0 for the process's own, or a path. */
  readonly stdin: number | string
  /** Standard output. */
  readonly stdout: TextSink
  /** Standard error. */
  readonly stderr: TextSink
}

/**
 * Runs the command against a process's arguments, working directory and streams, reading
 * standard input only when `--stdin` asks for it.
 *
 * @param process - The arguments, working directory, standard input and output streams
 * @returns The exit code: 0 clean, 1 problems, 2 the command could not run or a file could not be linted
 *
 * @example Run the command the way the installed bin does
 * ```ts
 * const code = await runHfLint({
 *   argv: ['src', '--fix'],
 *   cwd: process.cwd(),
 *   stdin: 0,
 *   stdout: process.stdout,
 *   stderr: process.stderr,
 * })
 * process.exitCode = code
 * ```
 */
export function runHfLint(process: HfLintProcess): Promise<number> {
  return run(process.argv, {
    cwd: process.cwd,
    readStdin: () => readFileSync(process.stdin, 'utf8'),
    write: (text) => process.stdout.write(text),
    writeError: (text) => process.stderr.write(text),
  })
}
