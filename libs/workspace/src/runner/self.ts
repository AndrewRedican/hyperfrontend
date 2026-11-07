/**
 * The command line this process was started as, so the tasks it starts in children run the same
 * program the same way: from source or from a built package, with whatever flags Node.js was
 * given.
 *
 * @module runner/self
 */

/** What of a running process names the command line it was started as. */
export interface StartedAs {
  /** The Node.js executable. */
  readonly execPath: string
  /** The flags Node.js itself was given. */
  readonly execArgv: readonly string[]
  /** The argument vector: the executable, the entry module, then the arguments. */
  readonly argv: readonly string[]
}

/**
 * The argument vector that starts this command line again with other arguments.
 *
 * @param started - The running process
 * @param args - The arguments of the new run
 * @returns The executable, its flags, the entry module and the arguments
 *
 * @example Starting a task in a child the way this process was started
 * ```typescript
 * import { spawn } from 'node:child_process'
 * import { selfCommand } from '@hyperfrontend/workspace/runner'
 *
 * const [program, ...args] = selfCommand(process, ['run', 'lib-core:build'])
 * // => ['/usr/bin/node', '--import=tsx', '/repo/node_modules/@hyperfrontend/workspace/bin/hf.mjs', 'run', 'lib-core:build']
 * spawn(program as string, args, { stdio: 'inherit' })
 * ```
 */
export function selfCommand(started: StartedAs, args: readonly string[]): string[] {
  return [started.execPath, ...started.execArgv, started.argv[1] as string, ...args]
}
