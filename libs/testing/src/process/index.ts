/**
 * Stand-ins for a process's terminal, standard streams and child processes, for testing
 * command-line tools and interactive prompts.
 *
 * @module @hyperfrontend/testing/process
 */
export type { FakeChildProcess, FakeChildProcessOptions, SpawnSyncResultOptions } from './child-process'
export type { Key } from './keys'
export type { ChildExit, SignalTarget, StopSignal } from './signals'
export type { CapturedStdio, CaptureStdioOptions } from './stdio'
export type { CapturedOutput, CapturedOutputOptions, TtyInput } from './terminal'
export { createFakeChildProcess, spawnSyncResult } from './child-process'
export { Keys } from './keys'
export { cleanSignalExit, sendSignal } from './signals'
export { captureStdio } from './stdio'
export { createCapturedOutput, createTtyInput, readAll } from './terminal'
