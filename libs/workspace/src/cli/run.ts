/**
 * The dispatch of the workspace's command line, as a function. From anywhere inside the
 * workspace, `run <project>:<target> [--name=value ...]` runs that one task, nothing it depends on
 * first and nothing cached: the dispatch answers that word itself, and this is the code every task
 * of a pipeline starts through. `--help` or `-h` where the task is named prints the usage and runs
 * nothing. Every other word it owns it looks up in the catalogue of commands, and a word it does
 * not own goes to the features command line, where that is installed.
 *
 * @module cli/run
 */

import type { Command } from './catalogue'
import type { HandoverHost, Invocation } from './handover'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findUpwardWhere } from '@hyperfrontend/project-scope/core'
import { installAliases } from '../hooks/index'
import { pathKey, searchPath } from '../runner/environment'
import { asksForHelp } from '../runner/overrides'
import { describeError } from '../runner/refusal'
import { main, USAGE as RUN_USAGE } from '../runner/run'
import { processStops } from '../runner/stops'
import { COMMANDS, isOwnCommand, USAGE } from './catalogue'
import { handOver, processHost } from './handover'

/** The file that marks a workspace root. */
export const WORKSPACE_FILE = 'hf.json'

/** What a run of the command line is given. */
export type WorkspaceCliOptions = Invocation

/** The command that runs one task, which the dispatch answers without the catalogue. */
const RUN = 'run'

/**
 * Runs the workspace's command line. The `hf` name is shared with `@hyperfrontend/features`:
 * where that package is installed, a command this one does not own is passed on to its command
 * line, and the usage is followed by its usage.
 *
 * @param options - The arguments, the starting directory and where to write
 * @param host - How the features command line is found and loaded
 * @returns The exit code: 0 when the command succeeded, 1 otherwise
 *
 * @example The command line as a function
 * ```typescript
 * import { runWorkspaceCli } from '@hyperfrontend/workspace/cli'
 *
 * const code = await runWorkspaceCli({
 *   argv: ['run-many', '-t', 'build', '-p', 'lib-*'],
 *   cwd: process.cwd(),
 *   stdout: process.stdout,
 *   stderr: process.stderr,
 * })
 * // => 0 when every task succeeded, 1 otherwise
 * ```
 *
 * @example Another `hf` command line passing a command on
 * ```typescript
 * const code = await runWorkspaceCli({ argv, cwd, stdout, stderr, handedOver: true })
 * // => the exit code; an unknown command is reported here rather than passed back
 * ```
 */
export async function runWorkspaceCli(options: WorkspaceCliOptions, host: HandoverHost = processHost()): Promise<number> {
  const { argv, cwd } = options
  const note = (line: string): void => void options.stderr.write(`${line}\n`)
  const say = (line: string): void => void options.stdout.write(`${line}\n`)
  const [command, ...rest] = argv
  if (command === undefined || asksForHelp([command])) {
    options.stdout.write(USAGE)
    if (options.handedOver !== true) await handOver({ ...options, argv: ['--help'] }, host)
    return command === undefined ? 1 : 0
  }
  if (command !== RUN && !isOwnCommand(command)) {
    const code = options.handedOver === true ? null : await handOver(options, host)
    if (code !== null) return code
    note(`hf: unknown command ${command}`)
    options.stderr.write(USAGE)
    return 1
  }
  // why: a generator may be what creates the workspace file, so it alone runs where there is none yet
  const root = findUpwardWhere(cwd, (directory) => existsSync(join(directory, WORKSPACE_FILE))) ?? (command === 'generate' ? cwd : null)
  if (root === null) {
    note(`run from inside the workspace: no ${WORKSPACE_FILE} above the working directory`)
    return 1
  }
  // why: the workspace's own executors, generators and configurations load from their TypeScript source
  installAliases(root)
  // why: every command reads its paths from the workspace root, wherever in the workspace it was typed
  process.chdir(root)
  const key = pathKey(process.env, process.platform)
  // why: the tasks and the processes their executors start find the workspace's own binaries first, as they did when npx started them
  process.env[key] = searchPath(root, process.env[key], process.execPath, process.platform)
  // why: a help word where the task is named asks for the usage; one after the task is the task's own argument
  if (command === RUN && asksForHelp(rest, 1)) {
    say(RUN_USAGE)
    return 0
  }
  if (command === RUN)
    return main(argv, {
      root,
      cwd,
      env: process.env,
      platform: process.platform,
      execPath: process.execPath,
      spawn: (line, spawnOptions) => spawn(line, spawnOptions),
      write: note,
      stops: processStops(),
      importModule: (file) => import(/* hf-graph: opaque */ pathToFileURL(file).href),
    })
  // why: a word that is neither `run` nor the catalogue's was passed on or refused above
  const [handler, usage] = COMMANDS[command] as readonly [Command, string]
  try {
    return await handler(rest, { root, cwd, say, note, sink: options.stderr })
  } catch (error) {
    note(`hf ${command}: ${describeError(error)}`)
    note(usage)
    return 1
  }
}
