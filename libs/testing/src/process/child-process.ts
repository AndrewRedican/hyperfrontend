import type { SpawnSyncReturns } from 'node:child_process'
import type { MockFn } from '../mock/types'
import type { CapturedOutput } from './terminal'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { realTimers } from '../async/real-timers'
import { createMockFn } from '../mock/mock-fn'
import { createCapturedOutput } from './terminal'

/**
 * A stand-in for the `ChildProcess` that `spawn`, `fork` and `exec` return, which a test
 * drives by hand.
 */
export interface FakeChildProcess extends EventEmitter {
  /** Process identifier. */
  pid: number
  /** What the parent wrote to the child's stdin. */
  stdin: CapturedOutput
  /** The child's stdout, fed by `writeStdout`. */
  stdout: PassThrough
  /** The child's stderr, fed by `writeStderr`. */
  stderr: PassThrough
  /** Exit code once exited normally, otherwise null. */
  exitCode: number | null
  /** Signal that ended the child, otherwise null. */
  signalCode: NodeJS.Signals | null
  /** Whether `kill` has been called. */
  killed: boolean
  /** Sends a signal. By default it marks the child killed and exits it with the signal on the next turn of the event loop; a child that already exited reports false. */
  kill: MockFn<[signal?: NodeJS.Signals | number], boolean>
  /** Writes text to the child's stdout. */
  writeStdout(text: string): void
  /** Writes text to the child's stderr. */
  writeStderr(text: string): void
  /** Ends the child: closes its output streams, emits `exit`, then `close` on the next turn of the event loop. */
  exit(code?: number | null, signal?: NodeJS.Signals | null): void
  /** Emits `error`, as a child that failed to start does. */
  fail(error: Error): void
}

/**
 * How a fake child process identifies itself.
 */
export type FakeChildProcessOptions = {
  /** Process identifier, for a test that asserts on it. Defaults to a fresh number per child. */
  pid?: number
}

/**
 * The result fields `spawnSyncResult` fills in when not given.
 */
export type SpawnSyncResultOptions = {
  /** Exit code. Defaults to 0, or null when a signal is given. */
  status?: number | null
  /** Signal that ended the process. Defaults to null. */
  signal?: NodeJS.Signals | null
  /** Text the process wrote to stdout. Defaults to empty. */
  stdout?: string
  /** Text the process wrote to stderr. Defaults to empty. */
  stderr?: string
  /** Process identifier. Defaults to 1. */
  pid?: number
  /** Why the process could not run, such as a missing executable. */
  error?: Error
}

/**
 * The next process identifier to hand out.
 */
const pids = { next: 1000 }

/**
 * Creates a child process for a mocked `spawn` to return, whose output, exit and failure
 * the test controls.
 *
 * @param options - The process identifier, when a test asserts on it.
 * @returns A child with no output and no exit, until the test supplies them.
 * @example Returning a scripted child from a mocked spawn
 * ```ts
 * jest.mock('node:child_process', () => ({ spawn: jest.fn() }))
 *
 * it('reports what the worker printed', async () => {
 *   const child = createFakeChildProcess()
 *   jest.mocked(spawn).mockReturnValue(child as never)
 *   const result = runWorker()
 *   child.writeStdout('{"ok":true}\n')
 *   child.exit(0)
 *   expect(await result).toEqual({ ok: true })
 * })
 * ```
 */
export function createFakeChildProcess(options: FakeChildProcessOptions = {}): FakeChildProcess {
  const child = new EventEmitter() as FakeChildProcess
  child.pid = options.pid ?? pids.next++
  child.stdin = createCapturedOutput()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.exitCode = null
  child.signalCode = null
  child.killed = false
  child.writeStdout = (text) => {
    child.stdout.write(text)
  }
  child.writeStderr = (text) => {
    child.stderr.write(text)
  }
  child.exit = (code = 0, signal = null) => {
    child.exitCode = signal ? null : code
    child.signalCode = signal
    child.stdout.end()
    child.stderr.end()
    child.emit('exit', child.exitCode, signal)
    realTimers.setImmediate(() => child.emit('close', child.exitCode, signal))
  }
  child.fail = (error) => {
    child.emit('error', error)
  }
  child.kill = createMockFn((signal?: NodeJS.Signals | number) => {
    if (child.exitCode !== null || child.signalCode !== null) return false
    child.killed = true
    realTimers.setImmediate(() => child.exit(null, typeof signal === 'string' ? signal : 'SIGTERM'))
    return true
  })
  return child
}

/**
 * Builds what `spawnSync` returns with `encoding: 'utf8'`, for a mocked `spawnSync` to hand
 * back.
 *
 * @param options - The fields that differ from a clean exit with no output.
 * @returns A complete result.
 * @example Scripting a failed command
 * ```ts
 * jest.mocked(spawnSync).mockReturnValue(spawnSyncResult({ status: 1, stderr: 'not signed' }))
 * expect(() => verifySignature('app')).toThrow('not signed')
 * ```
 */
export function spawnSyncResult(options: SpawnSyncResultOptions = {}): SpawnSyncReturns<string> {
  const stdout = options.stdout ?? ''
  const stderr = options.stderr ?? ''
  const signal = options.signal ?? null
  return {
    pid: options.pid ?? 1,
    output: [null, stdout, stderr],
    stdout,
    stderr,
    status: options.status !== undefined ? options.status : signal ? null : 0,
    signal,
    ...(options.error ? { error: options.error } : {}),
  }
}
