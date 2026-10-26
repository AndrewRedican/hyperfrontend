/**
 * The lock one writer of the state directory holds: a file created exclusively with the writer's
 * pid inside, stale once its writer is dead or it has outlived a bound, so a crashed build never
 * blocks the next one; a second writer waits for it, then proceeds.
 *
 * @module graph/store/lock
 */

import { closeSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isFinite, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { construct } from '@hyperfrontend/immutable-api-utils/built-in-copy/reflect'
import { createSharedArrayBuffer } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/** How a lock is taken. */
export interface LockOptions {
  /** After how many milliseconds a lock counts as stale whatever its holder, 60 s by default. */
  readonly staleMs?: number
  /** How long to wait for a live lock before giving up, 60 s by default. */
  readonly timeoutMs?: number
  /** How long to pause between attempts, 50 ms by default. */
  readonly pollMs?: number
}

/** The lock file's name within the state directory. */
export const LOCK_FILE = '.lock'

/**
 * Whether a process is alive.
 *
 * @param pid - The process id
 * @returns True when a signal can be sent to it
 */
function isAlive(pid: number): boolean {
  if (!isFinite(pid)) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Whether a lock file no longer protects anything: it is gone, older than the bound, or held by a
 * process that is not running.
 *
 * @param path - The lock file
 * @param staleMs - The bound on its age, in milliseconds
 * @returns True when the lock may be removed
 */
export function isStaleLock(path: string, staleMs: number): boolean {
  const stats = statSync(path, { throwIfNoEntry: false })
  if (stats === undefined) return true
  if (dateNow() - stats.mtimeMs > staleMs) return true
  return !isAlive(parseInt(readFileSync(path, 'utf8'), 10))
}

/**
 * Pauses the thread.
 *
 * @param ms - How long, in milliseconds
 */
function pause(ms: number): void {
  Atomics.wait(construct(Int32Array, [createSharedArrayBuffer(4)]) as Int32Array, 0, 0, ms)
}

/**
 * Takes the lock exclusively, if nobody holds it.
 *
 * @param path - The lock file
 * @returns True when this process now holds the lock
 */
function tryLock(path: string): boolean {
  try {
    const descriptor = openSync(path, 'wx')
    writeSync(descriptor, `${process.pid}\n`)
    closeSync(descriptor)
    return true
  } catch {
    return false
  }
}

/**
 * Runs work while holding the directory's lock, taken over from a stale holder and waited for
 * from a live one; the lock is released whether the work returns or throws.
 *
 * @param directory - The state directory, created when absent
 * @param work - The work run while the lock is held
 * @param options - The staleness bound, the wait and the poll interval
 * @returns What the work returned
 */
export function withLock<Result>(directory: string, work: () => Result, options: LockOptions = {}): Result {
  const { staleMs = 60_000, timeoutMs = 60_000, pollMs = 50 } = options
  mkdirSync(directory, { recursive: true })
  const path = join(directory, LOCK_FILE)
  const deadline = dateNow() + timeoutMs
  while (!tryLock(path)) {
    if (isStaleLock(path, staleMs)) rmSync(path, { force: true })
    else if (dateNow() >= deadline) throw createError(`the graph state at ${directory} is locked by another process`)
    else pause(pollMs)
  }
  try {
    return work()
  } finally {
    rmSync(path, { force: true })
  }
}
