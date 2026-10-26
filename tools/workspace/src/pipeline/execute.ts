/**
 * Runs one task as a child process from the workspace root, captures everything it prints into
 * its own log file, and replays that log in one block when the task ends so concurrent tasks
 * never interleave.
 *
 * @module pipeline/execute
 */

import type { ChildProcess, SpawnOptions } from 'node:child_process'
import type { Outcome as OutcomeKind, PlanTask } from './model'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { Outcome } from './model'

/** What a child process ended as. */
export interface CommandResult {
  /** The exit code, or null when a signal ended the process or it never started. */
  readonly exitCode: number | null
  /** The signal that ended the process, or null. */
  readonly signal: string | null
  /** Everything the process wrote, standard output and error in arrival order. */
  readonly output: string
  /** Standard output alone. */
  readonly stdout: string
  /** Standard error alone. */
  readonly stderr: string
  /** Whether the time limit ended the process. */
  readonly timedOut: boolean
  /** Why the process could not be started, or null. */
  readonly error: string | null
}

/** Starts a child process; `spawn` unless a test supplies another. */
export type Spawn = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess

/** How a command runs. */
export interface CommandOptions {
  /** The working directory. */
  readonly cwd: string
  /** Environment entries set on top of the process environment. */
  readonly env?: Readonly<Record<string, string>>
  /** Ends the process when aborted. */
  readonly signal?: AbortSignal
  /** Ends the process after this long, in milliseconds. */
  readonly timeoutMs?: number
  /** The process boundary. */
  readonly spawn?: Spawn
  /** The platform the command runs on; the process's own unless a test names another. */
  readonly platform?: string
}

/** What running a task ends as. */
export interface RunOutcome {
  /** Success, failure or cancellation, or a skip decided at run time such as a gate that did not open. */
  readonly outcome: OutcomeKind
  /** The exit code, or null. */
  readonly exitCode: number | null
  /** The log file, workspace-relative, or null when nothing was written. */
  readonly log: string | null
  /** What kept the task from running to an exit, or null. */
  readonly detail: string | null
}

/** How a task executes. */
export interface ExecuteOptions {
  /** The workspace root, absolute. */
  readonly root: string
  /** The directory the logs are written under, workspace-relative and POSIX. */
  readonly logDirectory: string
  /** Environment entries every task gets. */
  readonly env?: Readonly<Record<string, string>>
  /** Ends the running task when aborted. */
  readonly signal?: AbortSignal
  /** The process boundary. */
  readonly spawn?: Spawn
  /** The platform the task runs on. */
  readonly platform?: string
}

/**
 * The arguments as a Windows shell receives them: each one holding a space is quoted, because
 * `npm` and `npx` are `.cmd` shims there that only a shell can launch, and the shell splits an
 * unquoted argument at every space.
 *
 * @param args - The arguments
 * @param platform - `win32` or another platform name
 * @returns The arguments, quoted on Windows where needed
 */
export function shellSafe(args: readonly string[], platform: string): string[] {
  return platform === 'win32' ? args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)) : [...args]
}

/**
 * Runs a command to its end.
 *
 * @param command - The argument vector
 * @param options - Where and how it runs
 * @returns What it ended as, never a rejection
 */
export function runCommand(command: readonly string[], options: CommandOptions): Promise<CommandResult> {
  const platform = options.platform ?? process.platform
  const [file, ...args] = shellSafe(command, platform)
  const start = options.spawn ?? (spawn as Spawn)
  return createPromise((resolve) => {
    const chunks: string[] = []
    const stdout: string[] = []
    const stderr: string[] = []
    let timedOut = false
    let settled = false
    const child = start(file as string, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: platform === 'win32',
      windowsHide: true,
    })
    const stop = (): void => {
      child.kill('SIGTERM')
    }
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true
            stop()
          }, options.timeoutMs)
    const finish = (result: CommandResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', stop)
      resolve(result)
    }
    const collect = (text: string, own: string[]): void => {
      chunks.push(text)
      own.push(text)
    }
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (text: string) => collect(text, stdout))
    child.stderr?.on('data', (text: string) => collect(text, stderr))
    child.on('error', (error) =>
      finish({
        exitCode: null,
        signal: null,
        output: chunks.join(''),
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        timedOut,
        error: error.message,
      })
    )
    child.on('close', (code, signal) =>
      finish({ exitCode: code, signal, output: chunks.join(''), stdout: stdout.join(''), stderr: stderr.join(''), timedOut, error: null })
    )
    if (options.signal?.aborted) stop()
    else options.signal?.addEventListener('abort', stop, { once: true })
  })
}

/**
 * The log file of a task, under the log directory.
 *
 * @param task - The task the log belongs to
 * @param logDirectory - The directory, workspace-relative and POSIX
 * @returns The path, workspace-relative and POSIX
 */
export function logPathOf(task: PlanTask, logDirectory: string): string {
  return posix.join(logDirectory, `${task.id.replace(/[^A-Za-z0-9._-]/g, '__')}.log`)
}

/**
 * Runs a task and writes its log.
 *
 * @param task - The task to run
 * @param options - The root, the log directory, the environment and the signal
 * @returns What the task ended as; the log holds everything it printed
 */
export async function executeTask(task: PlanTask, options: ExecuteOptions): Promise<RunOutcome> {
  const result = await runCommand(task.command, {
    cwd: options.root,
    env: { ...options.env, ...task.env },
    signal: options.signal,
    spawn: options.spawn,
    platform: options.platform,
  })
  const log = logPathOf(task, options.logDirectory)
  mkdirSync(join(options.root, options.logDirectory), { recursive: true })
  writeFileSync(join(options.root, log), result.output)
  if (result.error !== null) return { outcome: Outcome.Failure, exitCode: null, log, detail: result.error }
  if (options.signal?.aborted === true)
    return { outcome: Outcome.Cancelled, exitCode: result.exitCode, log, detail: 'the run was interrupted' }
  return { outcome: result.exitCode === 0 ? Outcome.Success : Outcome.Failure, exitCode: result.exitCode, log, detail: null }
}

/**
 * The lines replaying a task's log as one block: a heading, the log, and the closing marker,
 * with the workflow commands that fold the block when the lines reach a GitHub job log.
 *
 * @param heading - The block's heading
 * @param log - The log text
 * @param grouped - Whether to wrap the block in `::group::` and `::endgroup::`
 * @returns The heading, the log lines and the closing marker
 */
export function replayLines(heading: string, log: string, grouped: boolean): string[] {
  const body = log === '' ? [] : log.replace(/\n$/, '').split(/\r?\n/)
  return grouped ? [`::group::${heading}`, ...body, '::endgroup::'] : [`── ${heading}`, ...body]
}
