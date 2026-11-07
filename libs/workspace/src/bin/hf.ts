/**
 * The `hf` executable: the workspace's command line, run on this process's arguments, working
 * directory and streams.
 *
 * @module bin/hf
 */

import { runWorkspaceCli } from '../cli/run'

/** What a run of the executable is given. */
export interface HfOptions {
  /** The arguments after the executable's name. */
  readonly argv: readonly string[]
  /** The directory the executable was started in. */
  readonly cwd: string
}

/**
 * Runs the `hf` executable.
 *
 * @param options - The arguments and the starting directory
 * @returns The exit code
 *
 * @example What the `hf` executable does
 * ```typescript
 * process.exitCode = await runHf({ argv: process.argv.slice(2), cwd: process.cwd() })
 * ```
 */
export function runHf(options: HfOptions): Promise<number> {
  return runWorkspaceCli({ ...options, stdout: process.stdout, stderr: process.stderr })
}
