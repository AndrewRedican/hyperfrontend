/**
 * How a step's program is started without a shell: `hf` is the command line that runs the hook,
 * started again the way it was; `node` is the running Node.js; anything else is found on the
 * search path, which on Windows means going through the command shim a package manager writes.
 *
 * @module git-hooks/program
 */

import type { StartedAs } from '../runner/self'
import { shimCommand } from '@hyperfrontend/project-scope/core'
import { selfCommand } from '../runner/self'

/** A program ready to be spawned. */
export interface Launch {
  /** The executable, or on Windows the whole command line of a shim. */
  readonly file: string
  /** Its arguments. */
  readonly args: readonly string[]
  /** Whether it starts through the platform shell, which only a Windows shim needs. */
  readonly shell: boolean
}

/**
 * How to start what a step runs.
 *
 * @param run - The program and its arguments, as the step writes them
 * @param started - The running process
 * @param platform - `win32` or another platform name
 * @returns The executable, its arguments and whether a shell starts it
 *
 * @example The command line itself, and a package's executable
 * ```typescript
 * import { launchOf } from '@hyperfrontend/workspace/git-hooks'
 *
 * launchOf(['hf', 'format', '--write'], process, process.platform)
 * // => { file: '/usr/bin/node', args: ['/repo/node_modules/@hyperfrontend/workspace/bin/hf.mjs', 'format', '--write'], shell: false }
 * launchOf(['cl', '.git/COMMIT_EDITMSG'], process, 'linux')
 * // => { file: 'cl', args: ['.git/COMMIT_EDITMSG'], shell: false }
 * ```
 */
export function launchOf(run: readonly string[], started: StartedAs, platform: NodeJS.Platform): Launch {
  const [program, ...args] = run as [string, ...string[]]
  if (program === 'node') return { file: started.execPath, args, shell: false }
  if (program === 'hf') {
    const [file, ...rest] = selfCommand(started, args) as [string, ...string[]]
    return { file, args: rest, shell: false }
  }
  return shimCommand(program, args, platform)
}
