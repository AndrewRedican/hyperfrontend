/**
 * The two commands the hooks add to the command line. `hooks run <hook>` is what a stub starts,
 * and by hand it rehearses the hook without committing or pushing; `push` runs the steps the
 * configuration lists under `push` and then pushes, so a commit those steps make is part of what
 * the push carries.
 *
 * @module git-hooks/command
 */

import type { ProgressSink } from '../progress/terminal'
import type { HookName, HookStep } from './config'
import type { HookHost } from './run'
import type { SkipSources } from './skips'
import { spawn } from 'node:child_process'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createTerminal } from '../progress/terminal'
import { readFlag } from '../runner/overrides'
import { refusal } from '../runner/refusal'
import { GIT_HOOKS, PUSH_STEPS } from './config'
import { loadHooks } from './load'
import { launchOf } from './program'
import { runHook } from './run'
import { namesOf, skipReason, unknownSkips } from './skips'
import { fullyStaged, gitIn, restage } from './staged'

/** What the command line expects. */
export const HOOKS_USAGE = 'usage: hf hooks run <hook> [--only=<step[,step]>] [--skip=<step[,step]>] [arguments of the hook ...]'

/** What the command line expects. */
export const PUSH_USAGE = 'usage: hf push [arguments of git push ...]'

/** Where a command of the hooks runs and writes. */
export interface HooksSession {
  /** The workspace root, absolute. */
  readonly root: string
  /** The stream the step list goes to. */
  readonly sink: ProgressSink
}

/** How a program is started. */
interface StartOptions {
  /** The environment, this process's when none is given. */
  readonly env?: NodeJS.ProcessEnv
  /** Whether the platform shell starts it. */
  readonly shell?: boolean
}

/** A `hooks run` read from the command line. */
interface RunRequest {
  /** The hook. */
  readonly hook: HookName
  /** The arguments Git gave the hook. */
  readonly args: readonly string[]
  /** The steps `--only` names. */
  readonly only: readonly string[]
  /** The steps `--skip` names. */
  readonly skip: readonly string[]
}

/** The hooks the command line runs by name. */
const RUNNABLE: readonly string[] = [...GIT_HOOKS, PUSH_STEPS]

/** The arguments of `push` that ask what it takes, which no step runs for. */
const HELP = ['--help', '-h']

/** The flags `hooks run` takes. */
const RUN_FLAGS = ['only', 'skip']

/**
 * Reads the arguments of `hooks run`.
 *
 * @param argv - The arguments after `hooks`
 * @returns The hook, Git's arguments and the steps selected or skipped
 * @throws {Error} A refusal for another subcommand, a hook that is not one, or a flag it does not take
 */
function parseRun(argv: readonly string[]): RunRequest {
  const [subcommand, hook, ...rest] = argv
  if (subcommand !== 'run') throw refusal('the hooks are run with hf hooks run <hook>')
  if (hook === undefined || !RUNNABLE.includes(hook)) throw refusal(`name the hook to run: ${RUNNABLE.join(', ')}`)
  const flags: Record<string, readonly string[]> = { only: [], skip: [] }
  const args: string[] = []
  for (const arg of rest) {
    if (!arg.startsWith('--')) {
      args.push(arg)
      continue
    }
    const { name, value } = readFlag(arg)
    if (!RUN_FLAGS.includes(name) || value === true) throw refusal(`hooks run takes --only=<steps> and --skip=<steps>, got ${arg}`)
    flags[name] = namesOf(value)
  }
  return { hook: hook as HookName, args, only: flags['only'] as readonly string[], skip: flags['skip'] as readonly string[] }
}

/**
 * Starts a program from the workspace root on this process's streams.
 *
 * @param root - The workspace root, absolute
 * @param file - The executable, or the command line of a shim
 * @param args - Its arguments
 * @param options - The environment, and whether a shell starts it
 * @returns The exit code, 1 for a program that cannot be started
 */
function started(root: string, file: string, args: readonly string[], options: StartOptions): Promise<number> {
  return createPromise((resolve) => {
    const child = spawn(file, args, { ...options, cwd: root, stdio: 'inherit', windowsHide: true })
    child.on('error', () => resolve(1))
    child.on('close', (code) => resolve(code ?? 1))
  })
}

/**
 * How the steps of a hook run in this process: each in a child on the terminal, from the
 * workspace root, with the step's variables over the environment.
 *
 * @param session - The workspace root and the stream written to
 * @returns The host the runner is given
 */
function processHost(session: HooksSession): HookHost {
  const git = gitIn(session.root)
  return {
    start: (step: HookStep, args) => {
      const launch = launchOf([...step.run, ...args], process, process.platform)
      return started(session.root, launch.file, launch.args, { env: { ...process.env, ...step.env }, shell: launch.shell })
    },
    now: () => performance.now(),
    terminal: createTerminal(session.sink, process.env),
    fullyStaged: () => fullyStaged(git),
    restage: (before) => restage(git, before),
  }
}

/**
 * Runs the steps a configuration lists under a name, less the ones skipped.
 *
 * @param request - The hook, Git's arguments and the steps selected or skipped
 * @param session - The workspace root and the stream written to
 * @returns The exit code: 0 when every step that ran succeeded or the hook has none, 1 otherwise
 */
async function runNamed(request: RunRequest, session: HooksSession): Promise<number> {
  const { config, local } = await loadHooks(session.root)
  const host = processHost(session)
  const sources: SkipSources = { env: process.env, local, only: request.only, skip: request.skip }
  for (const line of unknownSkips(config, sources)) host.terminal.line(line)
  const steps = config[request.hook] ?? []
  if (steps.length === 0) return 0
  return runHook({ hook: request.hook, steps, args: request.args, skipOf: (step) => skipReason(request.hook, step, sources) }, host)
}

/**
 * Runs `hooks run <hook>`: the steps of a hook, in order, as the stub of that hook starts them.
 *
 * @param argv - The arguments after `hooks`
 * @param session - The workspace root and the stream written to
 * @returns The exit code: 0 when every step that ran succeeded, 1 otherwise
 * @throws {Error} A refusal for arguments it cannot read or a configuration it cannot load
 *
 * @example Rehearsing a push without the long step
 * ```typescript
 * import { runHooksCommand } from '@hyperfrontend/workspace/git-hooks'
 *
 * const code = await runHooksCommand(['run', 'pre-push', '--skip=pipeline'], { root: process.cwd(), sink: process.stderr })
 * // => 0 when the other steps of pre-push succeeded; the list says pipeline was skipped by --skip
 * ```
 */
export function runHooksCommand(argv: readonly string[], session: HooksSession): Promise<number> {
  return runNamed(parseRun(argv), session)
}

/**
 * Runs `push`: the configuration's `push` steps, then `git push` with the arguments given. The
 * pre-push hook then runs as on any push, on the commits the push carries. Asked for help, it
 * prints its usage and runs nothing.
 *
 * @param argv - The arguments after `push`, passed to `git push`
 * @param session - The workspace root and the stream written to
 * @returns The exit code of the first step that failed, else of `git push`
 * @throws {Error} A refusal for a configuration it cannot load
 *
 * @example Pushing a branch for the first time
 * ```typescript
 * import { runPushCommand } from '@hyperfrontend/workspace/git-hooks'
 *
 * const code = await runPushCommand(['--set-upstream', 'origin', 'feature'], { root: process.cwd(), sink: process.stderr })
 * // => 0 once the push steps succeeded and git pushed
 * ```
 */
export async function runPushCommand(argv: readonly string[], session: HooksSession): Promise<number> {
  if (argv.some((arg) => HELP.includes(arg))) {
    session.sink.write(`${PUSH_USAGE}\n`)
    return 0
  }
  const code = await runNamed({ hook: PUSH_STEPS, args: [], only: [], skip: [] }, session)
  return code === 0 ? started(session.root, 'git', ['push', ...argv], {}) : code
}
